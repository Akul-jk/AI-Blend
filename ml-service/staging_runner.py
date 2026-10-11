"""Fail-closed, resource-limited subprocess runner for model candidates."""
from __future__ import annotations

import json
import os
import subprocess
import sys
import threading
from pathlib import Path

WALL_TIMEOUT_SECONDS = 180
CPU_LIMIT_SECONDS = 120
MEMORY_LIMIT_BYTES = 3 * 1024 * 1024 * 1024
MAX_CAPTURE_BYTES = 1024 * 1024


class StagingRunnerError(RuntimeError):
    pass


class _Capture:
    def __init__(self, stream):
        self.data = bytearray()
        self.stream = stream
        self.thread = threading.Thread(target=self._read, daemon=True)
        self.thread.start()

    def _read(self):
        while True:
            chunk = self.stream.read(65536)
            if not chunk:
                break
            remaining = MAX_CAPTURE_BYTES - len(self.data)
            if remaining > 0:
                self.data.extend(chunk[:remaining])

    def finish(self):
        self.thread.join(timeout=5)
        return bytes(self.data).decode("utf-8", errors="replace")


class _WindowsJob:
    """Assign a suspended process to a kill-on-close Windows Job Object."""
    def __init__(self, process):
        import ctypes
        from ctypes import wintypes
        self.ctypes, self.wintypes = ctypes, wintypes
        class Basic(ctypes.Structure):
            _fields_ = [("PerProcessUserTimeLimit", ctypes.c_longlong),
                        ("PerJobUserTimeLimit", ctypes.c_longlong),
                        ("LimitFlags", wintypes.DWORD), ("MinimumWorkingSetSize", ctypes.c_size_t),
                        ("MaximumWorkingSetSize", ctypes.c_size_t), ("ActiveProcessLimit", wintypes.DWORD),
                        ("Affinity", ctypes.c_size_t), ("PriorityClass", wintypes.DWORD),
                        ("SchedulingClass", wintypes.DWORD)]
        class IoCounters(ctypes.Structure):
            _fields_ = [(name, ctypes.c_ulonglong) for name in
                        ("ReadOperationCount", "WriteOperationCount", "OtherOperationCount",
                         "ReadTransferCount", "WriteTransferCount", "OtherTransferCount")]
        class Extended(ctypes.Structure):
            _fields_ = [("BasicLimitInformation", Basic), ("IoInfo", IoCounters),
                        ("ProcessMemoryLimit", ctypes.c_size_t), ("JobMemoryLimit", ctypes.c_size_t),
                        ("PeakProcessMemoryUsed", ctypes.c_size_t), ("PeakJobMemoryUsed", ctypes.c_size_t)]
        self.Extended = Extended
        kernel = ctypes.WinDLL("kernel32", use_last_error=True)
        self.kernel = kernel
        kernel.CreateJobObjectW.restype = wintypes.HANDLE
        self.handle = kernel.CreateJobObjectW(None, None)
        if not self.handle:
            raise self._error("CreateJobObjectW")
        limits = Extended()
        # Kill on close and cap the full worker tree, not only each child.
        limits.BasicLimitInformation.LimitFlags = (
            0x00002000 | 0x00000008 | 0x00000100 | 0x00000200 | 0x00000002 | 0x00000004
        )
        # TensorFlow may start short-lived helper processes (for example device
        # discovery); all descendants remain in this job and are bounded here.
        limits.BasicLimitInformation.ActiveProcessLimit = 8
        limits.BasicLimitInformation.PerProcessUserTimeLimit = CPU_LIMIT_SECONDS * 10_000_000
        limits.BasicLimitInformation.PerJobUserTimeLimit = CPU_LIMIT_SECONDS * 10_000_000
        limits.ProcessMemoryLimit = MEMORY_LIMIT_BYTES
        limits.JobMemoryLimit = MEMORY_LIMIT_BYTES
        if not kernel.SetInformationJobObject(self.handle, 9, ctypes.byref(limits), ctypes.sizeof(limits)):
            self.close()
            raise self._error("SetInformationJobObject")
        if not kernel.AssignProcessToJobObject(self.handle, wintypes.HANDLE(int(process._handle))):
            self.close()
            raise self._error("AssignProcessToJobObject")

    def _error(self, operation):
        return StagingRunnerError(f"Windows process isolation failed at {operation}; candidate worker was not allowed to run")

    def resume(self, process):
        # CPython closes CreateProcess's primary thread handle after creation;
        # NtResumeProcess resumes the suspended process via its retained handle.
        ntdll = self.ctypes.WinDLL("ntdll", use_last_error=True)
        status = ntdll.NtResumeProcess(self.wintypes.HANDLE(int(process._handle)))
        if status != 0:
            raise self._error("ResumeThread")

    def terminate(self):
        if self.handle:
            self.kernel.TerminateJobObject(self.handle, 1)

    def close(self):
        if self.handle:
            self.kernel.CloseHandle(self.handle)
            self.handle = None


class IsolatedStagingRunner:
    """Callable accepted by ModelRegistry.stage_candidate; never runs in-process."""
    def __init__(self, timeout_seconds: int = WALL_TIMEOUT_SECONDS):
        if not 1 <= timeout_seconds <= 600:
            raise ValueError("staging timeout must be between 1 and 600 seconds")
        self.timeout_seconds = timeout_seconds

    def __call__(self, candidate_dir: Path, metadata: dict) -> dict:
        candidate_dir = Path(candidate_dir).resolve()
        if not candidate_dir.is_dir():
            raise StagingRunnerError("candidate directory is missing")
        worker = Path(__file__).with_name("staging_worker.py")
        env = os.environ.copy()
        env.update({"TF_NUM_INTRAOP_THREADS": "1", "TF_NUM_INTEROP_THREADS": "1",
                    "OMP_NUM_THREADS": "1", "OPENBLAS_NUM_THREADS": "1",
                    "MKL_NUM_THREADS": "1", "TF_CPP_MIN_LOG_LEVEL": "2",
                    "PYTHONNOUSERSITE": "1"})
        if os.name != "nt":
            raise StagingRunnerError("No supported OS resource-isolation backend is available; staging is disabled")
        # Constants are absent from the module in some embedded Python builds.
        flags = getattr(subprocess, "CREATE_SUSPENDED", 0x00000004) | getattr(subprocess, "CREATE_NO_WINDOW", 0x08000000)
        job = None
        kwargs = {"stdout": subprocess.PIPE, "stderr": subprocess.PIPE, "env": env,
                  "close_fds": True, "creationflags": flags}
        process = subprocess.Popen([sys.executable, "-I", "-B", str(worker), str(candidate_dir)], **kwargs)
        stdout, stderr = _Capture(process.stdout), _Capture(process.stderr)
        try:
            job = _WindowsJob(process)
            job.resume(process)
            try:
                code = process.wait(timeout=self.timeout_seconds)
            except subprocess.TimeoutExpired as exc:
                if job:
                    job.terminate()
                else:
                    process.kill()
                process.wait()
                raise StagingRunnerError(f"candidate staging exceeded {self.timeout_seconds}s wall-clock limit") from exc
        except Exception:
            if process.poll() is None:
                if job:
                    job.terminate()
                else:
                    process.kill()
                process.wait()
            raise
        finally:
            if job:
                job.close()
        out, err = stdout.finish(), stderr.finish()
        if code != 0:
            raise StagingRunnerError((err or out or f"candidate worker exited with code {code}").strip()[-3000:])
        try:
            result = json.loads(out)
        except json.JSONDecodeError as exc:
            raise StagingRunnerError("candidate worker returned invalid JSON") from exc
        result["probe"]["output_shape"] = [int(x) for x in result["probe"]["output_shape"]]
        return result
