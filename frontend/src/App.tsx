import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './context/AuthContext';
import ErrorBoundary from './components/ErrorBoundary';
import { ToastContainer } from './components/ui/Toast';
import AppShell from './components/layout/AppShell';

// Page Views
import LoginView from './pages/Login/LoginView';
import RegisterView from './pages/Register/RegisterView';
import ForgotPasswordView from './pages/ForgotPassword/ForgotPasswordView';
import ResetView from './pages/ResetPassword/ResetView';
import DashboardView from './pages/Dashboard/DashboardView';
import PlaceholderView from './pages/Placeholder/PlaceholderView';
import LiveMonitoringView from './pages/LiveMonitoring/LiveMonitoringView';
import AIOverviewView from './pages/AIOverview/AIOverviewView';
import DatasetView from './pages/Dataset/DatasetView';
import ModelTrainingView from './pages/ModelTraining/ModelTrainingView';
import ModelComparisonView from './pages/ModelComparison/ModelComparisonView';
import PredictionsView from './pages/Predictions/PredictionsView';
import SensorDashboardView from './pages/SensorDashboard/SensorDashboardView';
import EnergyAnalyticsView from './pages/EnergyAnalytics/EnergyAnalyticsView';
import HistoricalDataView from './pages/HistoricalData/HistoricalDataView';
import ReportsView from './pages/Reports/ReportsView';
import AlertsView from './pages/Alerts/AlertsView';
import DeviceView from './pages/Device/DeviceView';
import SettingsView from './pages/Settings/SettingsView';
import ProfileView from './pages/Profile/ProfileView';
import { Activity } from 'lucide-react';

const queryClient = new QueryClient();

// Route wrapper to protect authentication and enforce session checks
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        <Activity className="w-8 h-8 animate-spin text-emerald-400" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

// Global App Shell Router
const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ErrorBoundary>
          <Router>
            <Routes>
              {/* Unprotected Auth routes */}
              <Route path="/login" element={<LoginView />} />
              <Route path="/register" element={<RegisterView />} />
              <Route path="/forgot-password" element={<ForgotPasswordView />} />
              <Route path="/reset-password" element={<ResetView />} />
              
              {/* Protected Workspace Layout Routes */}
              <Route 
                element={
                  <ProtectedRoute>
                    <AppShell />
                  </ProtectedRoute>
                }
              >
                <Route path="/" element={<DashboardView />} />
                <Route path="/monitoring" element={<LiveMonitoringView />} />
                <Route path="/analytics" element={<EnergyAnalyticsView />} />
                <Route path="/sensors" element={<SensorDashboardView />} />
                <Route path="/ai" element={<AIOverviewView />} />
                <Route path="/predictions" element={<PredictionsView />} />
                <Route path="/history" element={<HistoricalDataView />} />
                <Route path="/reports" element={<ReportsView />} />
                <Route path="/alerts" element={<AlertsView />} />
                <Route path="/device" element={<DeviceView />} />
                <Route path="/datasets" element={<DatasetView />} />
                <Route path="/training" element={<ModelTrainingView />} />
                <Route path="/comparison" element={<ModelComparisonView />} />
                <Route path="/settings" element={<SettingsView />} />
                <Route path="/profile" element={<ProfileView />} />
                
                {/* Fallback navigation redirects back to Home */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </Router>
          <ToastContainer />
        </ErrorBoundary>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
