import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './context/AuthContext';
import AppShell from './components/layout/AppShell';
import ErrorBoundary from './components/ErrorBoundary';
import { ToastContainer } from './components/ui/Toast';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30000, retry: 1 },
  },
});

// Eager load dashboard
const DashboardView = React.lazy(() => import('./pages/DashboardView'));

// Lazy load all other pages
const AppliancesView = React.lazy(() => import('./pages/Appliances/AppliancesView'));
const ApplianceDetailView = React.lazy(() => import('./pages/Appliances/ApplianceDetailView'));
const LiveMonitoringView = React.lazy(() => import('./pages/LiveMonitoringView'));
const EnergyAnalyticsView = React.lazy(() => import('./pages/EnergyAnalyticsView'));
const AIOverviewView = React.lazy(() => import('./pages/AIOverviewView'));
const PredictionsView = React.lazy(() => import('./pages/PredictionsView'));
const HistoricalDataView = React.lazy(() => import('./pages/HistoricalDataView'));
const ModelTrainingView = React.lazy(() => import('./pages/ModelTrainingView'));
const SettingsView = React.lazy(() => import('./pages/SettingsView'));

// Keep existing page structure for pages not yet redesigned
const AlertsView = React.lazy(() => import('./pages/Alerts/AlertsView'));
const DeviceView = React.lazy(() => import('./pages/Device/DeviceView'));
const DatasetView = React.lazy(() => import('./pages/Dataset/DatasetView'));
const ModelComparisonView = React.lazy(() => import('./pages/ModelComparison/ModelComparisonView'));
const ModelManagementView = React.lazy(() => import('./pages/ModelManagement/ModelManagementView'));
const ReportsView = React.lazy(() => import('./pages/Reports/ReportsView'));
const ProfileView = React.lazy(() => import('./pages/Profile/ProfileView'));
const SensorDashboardView = React.lazy(() => import('./pages/SensorDashboard/SensorDashboardView'));

// Auth pages
const LoginView = React.lazy(() => import('./pages/Login/LoginView'));
const RegisterView = React.lazy(() => import('./pages/Register/RegisterView'));
const ForgotPasswordView = React.lazy(() => import('./pages/ForgotPassword/ForgotPasswordView'));
const ResetView = React.lazy(() => import('./pages/ResetPassword/ResetView'));

// Loading screen
const LoadingScreen = () => (
  <div role="status" className="flex h-screen w-screen items-center justify-center bg-[var(--canvas)]">
    <div className="flex flex-col items-center gap-4">
      <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-[color-mix(in_srgb,var(--accent)_20%,transparent)] border-t-[var(--accent)]"></div>
      <span className="text-sm text-[var(--text-muted)]">Loading Energy Intelligence…</span>
    </div>
  </div>
);

// Protected route wrapper
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <LoadingScreen />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return <>{children}</>;
};

const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ErrorBoundary>
          <BrowserRouter>
            <Suspense fallback={<LoadingScreen />}>
              <ToastContainer />
              <Routes>
                {/* Public auth routes */}
                <Route path="/login" element={<LoginView />} />
                <Route path="/register" element={<RegisterView />} />
                <Route path="/forgot-password" element={<ForgotPasswordView />} />
                <Route path="/reset-password" element={<ResetView />} />

                {/* Protected routes inside AppShell */}
                <Route element={
                  <ProtectedRoute>
                    <AppShell />
                  </ProtectedRoute>
                }>
                  {/* OVERVIEW */}
                  <Route path="/" element={<DashboardView />} />
                  <Route path="/monitoring" element={<LiveMonitoringView />} />
                  <Route path="/analytics" element={<EnergyAnalyticsView />} />

                  {/* INTELLIGENCE */}
                  <Route path="/ai" element={<AIOverviewView />} />
                  <Route path="/predictions" element={<PredictionsView />} />

                  {/* DATA */}
                  <Route path="/history" element={<HistoricalDataView />} />
                  <Route path="/datasets" element={<DatasetView />} />
                  <Route path="/reports" element={<ReportsView />} />

                  {/* SYSTEM */}
                  <Route path="/appliances" element={<AppliancesView />} />
                  <Route path="/appliances/:id" element={<ApplianceDetailView />} />
                  <Route path="/device" element={<DeviceView />} />
                  <Route path="/sensors" element={<SensorDashboardView />} />
                  <Route path="/alerts" element={<AlertsView />} />
                  <Route path="/settings" element={<SettingsView />} />

                  {/* AI/ADMIN */}
                  <Route path="/training" element={<ModelTrainingView />} />
                  <Route path="/comparison" element={<ModelComparisonView />} />
                  <Route path="/model-management" element={<ModelManagementView />} />

                  {/* Profile */}
                  <Route path="/profile" element={<ProfileView />} />

                  {/* Fallback */}
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Route>
              </Routes>
            </Suspense>
          </BrowserRouter>
        </ErrorBoundary>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
