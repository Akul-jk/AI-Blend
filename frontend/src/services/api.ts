import axios from 'axios';
import type {
  Appliance, ApplianceWithDetails, ApplianceCategory,
  TelemetryReading, DashboardSummary, ApplianceBreakdown, EnergyTrend,
  Alert, SystemStatus, DatasetInfo, MLModelInfo, MLMetrics, MLPrediction,
  BillBreakdown, Esp32Device, PzemDevice
} from '../types';

const API_URL = `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/v1`;

const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
});

// Request interceptor - attach JWT token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor - unwrap envelope and handle 401
api.interceptors.response.use(
  (response) => {
    // Unwrap { success, data, message } envelope
    if (response.data && typeof response.data === 'object' && 'success' in response.data) {
      response.data = response.data.data;
    }
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// ---- Appliances ----
export const fetchAppliances = () => api.get<ApplianceWithDetails[]>('/appliances');
export const fetchAppliance = (id: string | number) => api.get<ApplianceWithDetails>(`/appliances/${id}`);
export const createAppliance = (data: Partial<Appliance> & { rating?: any }) => api.post('/appliances', data);
export const updateAppliance = (id: string | number, data: Partial<Appliance>) => api.put(`/appliances/${id}`, data);
export const deleteAppliance = (id: string | number) => api.delete(`/appliances/${id}`);
export const fetchApplianceTelemetry = (id: string | number, params?: { limit?: number; from?: string; to?: string }) =>
  api.get<TelemetryReading[]>(`/appliances/${id}/telemetry`, { params });
export const fetchApplianceAnalytics = (id: string | number) => api.get(`/appliances/${id}/analytics`);
export const fetchApplianceCategories = () => api.get<ApplianceCategory[]>('/appliance-categories/categories');

// ---- Telemetry ----
export const fetchTelemetryLatest = () => api.get<TelemetryReading[]>('/telemetry/latest');
export const fetchTelemetryHistory = (params?: { appliance_id?: string; from?: string; to?: string; limit?: number }) =>
  api.get<TelemetryReading[]>('/telemetry/history', { params });
export const fetchTelemetryTotals = () => api.get('/telemetry/totals');

// ---- Analytics ----
export const fetchAnalyticsSummary = () => api.get<DashboardSummary>('/analytics/summary');
export const fetchAnalyticsBreakdown = () => api.get<ApplianceBreakdown[]>('/analytics/breakdown');
export const fetchAnalyticsTrends = (period: string = 'daily') => api.get<EnergyTrend[]>(`/analytics/trends?period=${period}`);
export const fetchBillingUsage = () => api.get<{ consumption: number; period_start: string }>('/analytics/billing-usage');

// ---- Tariff / Billing ----
export const fetchTariff = () => api.get('/tariff');
export const updateTariff = (id: number, data: any) => api.put(`/tariff/${id}`, data);
export const calculateBill = (consumption: number, options?: { green_enabled?: boolean; phase_type?: string }) =>
  api.post<BillBreakdown>('/tariff/calculate', { consumption, ...options });
export const previewBill = (consumption: number, greenEnabled?: boolean, phaseType?: string) =>
  api.get(`/tariff/preview?consumption=${consumption}&green_enabled=${greenEnabled || false}&phase_type=${phaseType || 'single'}`);

// ---- ML / Predictions ----
export const trainModel = (config?: any) => api.post('/ml/train', config || {});
export const predictEnergy = (applianceId: string | number, recentReadings?: TelemetryReading[]) =>
  api.post<MLPrediction>('/ml/predict', { appliance_id: applianceId, recent_readings: recentReadings });
export const evaluateModel = () => api.post('/ml/evaluate');
export const fetchModelInfo = () => api.get<MLModelInfo>('/ml/model');
export const fetchModelMetrics = () => api.get<MLMetrics>('/ml/metrics');
export const fetchModels = () => api.get('/ml/models');
export interface ManagedModel {
  id?: string;
  version?: string;
  active_version?: string;
  model_id?: string;
  model_version?: string;
  status: string;
  active?: boolean;
  source?: string;
  model_type?: string;
  framework?: string;
  framework_version?: string;
  tensorflow_version?: string;
  dataset_provenance?: string;
  created_at_utc?: string;
  package_sha256?: string;
  reason?: string;
  sequence_length?: number;
  feature_count?: number;
  feature_columns?: string[];
  sampling_interval_ms?: number | null;
  target_column?: string;
  target_unit?: string;
  validation_report?: Record<string, any>;
  metrics?: Record<string, number | null> | null;
  activation_history?: Array<{ from: string; to: string; created_at_utc?: string }>;
}
export interface ModelValidationReport {
  status: 'validated' | 'rejected';
  id?: string;
  package_sha256?: string;
  reason?: string;
  report?: Record<string, any>;
  checks?: Record<string, string>;
  contract?: Record<string, any>;
  probe?: Record<string, any>;
  runtime?: Record<string, any>;
}
export const fetchManagedModels = () => api.get<{ active_version: string; models: ManagedModel[] }>('/ml/model-management/models');
export const fetchManagedModel = (version: string) => api.get<ManagedModel>(`/ml/model-management/models/${encodeURIComponent(version)}`);
export const fetchModelHistory = () => api.get<{ active_version: string; rollback_version?: string | null; activation_history: ManagedModel['activation_history']; rejected_candidates: ManagedModel[] }>('/ml/model-management/history');
export const validateModelPackage = (file: File, onUploadProgress?: (percent: number) => void) =>
  api.post<ModelValidationReport>('/ml/model-management/models/validate', file, {
    headers: { 'Content-Type': 'application/zip' }, timeout: 240000,
    onUploadProgress: event => onUploadProgress?.(event.total ? Math.round(event.loaded * 100 / event.total) : 0),
  });
export const stageModelPackage = (file: File, onUploadProgress?: (percent: number) => void) =>
  api.post<ModelValidationReport & { version?: string }>('/ml/model-management/models/stage', file, {
    headers: { 'Content-Type': 'application/zip' }, timeout: 240000,
    onUploadProgress: event => onUploadProgress?.(event.total ? Math.round(event.loaded * 100 / event.total) : 0),
  });
export const activateManagedModel = (version: string) =>
  api.post(`/ml/model-management/models/${encodeURIComponent(version)}/activate`);
export const rollbackManagedModel = (version?: string) => api.post('/ml/model-management/rollback', { version });
export const deleteManagedModel = (version: string) => api.delete(`/ml/model-management/models/${encodeURIComponent(version)}`);
export const generateDataset = () => api.post('/ml/dataset/generate');

// ---- Alerts ----
export const fetchAlerts = () => api.get<Alert[]>('/alerts');
export const resolveAlert = (id: number) => api.put(`/alerts/${id}`, { resolved: 1 });
export const deleteAlert = (id: number) => api.delete(`/alerts/${id}`);

// ---- Devices ----
export const fetchEsp32Devices = () => api.get<Esp32Device[]>('/esp32-devices');
export const fetchPzemDevices = () => api.get<PzemDevice[]>('/pzem-devices');
export const fetchSystemStatus = () => api.get<SystemStatus>('/system/status');

// ---- Datasets ----
export const fetchDatasets = () => api.get<DatasetInfo[]>('/dataset');
export const deleteDataset = (id: number) => api.delete(`/dataset/${id}`);

// ---- Reports ----
export const generateReport = (config: any) => api.post('/reports/generate', config);
export const fetchReports = () => api.get('/reports');

// ---- Settings ----
export const fetchSettings = () => api.get('/settings');
export const updateSettings = (data: any) => api.put('/settings', data);

// ---- Auth (for direct use) ----
export const loginUser = (username: string, password: string) =>
  axios.post(`${API_URL}/auth/login`, { username, password });
export const registerUser = (username: string, email: string, password: string) =>
  axios.post(`${API_URL}/auth/register`, { username, email, password });
export const forgotPassword = (username: string) =>
  axios.post(`${API_URL}/auth/forgot-password`, { username });
export const resetPassword = (username: string, code: string, newPassword: string) =>
  axios.post(`${API_URL}/auth/reset-password`, { username, code, newPassword });

export default api;
