# AI Blend - AI Energy Analytics Platform

AI Blend is a modular, scalable AI-powered energy analytics platform. It features real-time IoT sensor monitoring, historical analysis, anomaly alerts, automated reporting, and a comprehensive Machine Learning workspace for prediction and explainability.

## Project Structure

```
AI blend/
├── frontend/             # React SPA (Vite + TS + Tailwind CSS + shadcn/ui)
├── backend/              # Node.js + Express API + Socket.IO server (TypeScript)
└── README.md             # This instructions file
```

## Setup & Running

This project uses a portable Node.js environment configured locally for reliability.

### 1. Prerequisites
- Portable Node.js is located at `C:\Users\AKUL\.antigravity\node-portable`.
- Commands should be run with this directory prepended to the system `PATH`.

### 2. Backend Setup
1. Open a terminal and run the following command to install dependencies:
   ```powershell
   $env:PATH = "C:\Users\AKUL\.antigravity\node-portable;" + $env:PATH
   cd backend
   npm install
   ```
2. Start the backend developer server:
   ```powershell
   npm run dev
   ```

### 3. Frontend Setup
1. Open a terminal and run the following command to install dependencies:
   ```powershell
   $env:PATH = "C:\Users\AKUL\.antigravity\node-portable;" + $env:PATH
   cd frontend
   npm install
   ```
2. Start the frontend developer server:
   ```powershell
   npm run dev
   ```
