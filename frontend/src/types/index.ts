// ============================================================
// Smart Energy Monitor — Shared Frontend Types
// ============================================================

// ---- Data Source ----
export type DataSourceMode = 'simulation' | 'hardware';
export type ModelSourceMode = 'simulation' | 'hardware';

// ---- Telemetry Contract (matches backend + ML service) ----
export interface TelemetryReading {
  id?: number;
  timestamp: string;
  pzem_id: string | null;
  appliance_id: string | number | null;
  voltage: number;
  current: number;
  power: number;
  energy: number;
  interval_energy_kwh?: number | null;
  quality?: 'valid' | 'baseline' | 'counter_reset' | 'energy_jump';
  received_at?: string;
  frequency: number;
  power_factor: number;
  source: DataSourceMode;
  device_id?: string;
  circuit_id?: string;
}

// ---- Appliance ----
export interface Appliance {
  id: string | number;
  name: string;
  category: string;
  manufacturer: string;
  model: string;
  serial_number?: string;
  description?: string;
  location: string;
  image_url?: string;
  pzem_id: string | null;
  circuit_id?: number | null;
  status: 'active' | 'online' | 'offline' | 'standby' | 'error';
  created_at: string;
  updated_at: string;
}

export interface ApplianceRating {
  id?: number;
  appliance_id: string | number;
  rated_voltage: number;
  rated_current: number;
  rated_power: number;
  rated_frequency: number;
  rated_power_factor?: number;
  standby_power?: number;
  energy_class?: string;
}

export interface ApplianceCategory {
  id: number;
  name: string;
  icon: string;
  default_power_range?: string;
}

export interface ApplianceWithDetails extends Appliance {
  rating?: ApplianceRating;
  latest_telemetry?: TelemetryReading;
  energy_today?: number;
  energy_week?: number;
  energy_month?: number;
  peak_power?: number;
  avg_power?: number;
}

// ---- Device / PZEM / Circuit ----
export interface Esp32Device {
  id: string;
  name: string;
  ip_address?: string;
  firmware_version?: string;
  status: 'online' | 'offline';
  last_seen: string;
  created_at: string;
}

export interface PzemDevice {
  id: string;
  address: string | number;
  esp32_device_id: string;
  status: 'online' | 'offline';
  last_seen: string;
  assigned_appliance_id?: string;
  assigned_appliance_name?: string;
  created_at: string;
}

export interface Circuit {
  id: string;
  name: string;
  pzem_id: string;
  description?: string;
  location?: string;
}

// ---- ML / Predictions ----
export interface MLPrediction {
  source: ModelSourceMode;
  model: string;
  model_version: string;
  appliance_id: string;
  prediction: number;
  unit: string;
  timestamp: string;
}

export interface MLModelInfo {
  name: string;
  version: string;
  dataset_source: DataSourceMode;
  features: string[];
  sequence_length: number;
  sampling_interval: string;
  training_date: string;
  status: 'trained' | 'training' | 'failed' | 'not_trained';
  metrics?: MLMetrics;
  appliance_scope: string;
}

export interface MLMetrics {
  mae: number;
  rmse: number;
  r2: number;
  mape: number;
  wape?: number;
  dataset_source?: DataSourceMode;
  test_samples?: number;
  target?: string;
  unit?: string;
}

export interface TrainingRun {
  id: number;
  model_name: string;
  model_version: string;
  dataset_source: DataSourceMode;
  features: string;
  sequence_length: number;
  epochs_completed: number;
  max_epochs: number;
  batch_size: number;
  metrics?: string; // JSON
  status: 'running' | 'completed' | 'failed';
  started_at: string;
  completed_at?: string;
}

// ---- Anomaly ----
export interface Anomaly {
  id: number;
  appliance_id: string;
  appliance_name?: string;
  metric: string;
  actual_value: number;
  expected_value: number;
  deviation: number;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  timestamp: string;
  resolved: boolean;
}

// ---- Tariff / Billing ----
export type TariffMode = 'LT_I_TELESCOPIC' | 'NON_TELESCOPIC_FLAT';
export type PhaseType = 'single' | 'three';

export interface TariffSlab {
  id?: number;
  tariff_id?: number;
  from_units: number;
  to_units: number;
  rate: number;
  slab_type: TariffMode;
  enabled: boolean;
}

export interface TariffConfig {
  id: number;
  tariff_name: string;
  tariff_type: TariffMode;
  phase_type: PhaseType;
  currency: string;
  fuel_surcharge_per_unit: number;
  electricity_duty_percent: number;
  fixed_charge: number;
  meter_rent: number;
  green_tariff_enabled: boolean;
  green_tariff_rate: number;
  is_active: boolean;
  effective_from: string;
  version: number;
  slabs: TariffSlab[];
}

export interface BillBreakdown {
  consumption: number;
  tariff_mode: TariffMode;
  phase_type: PhaseType;
  energy_charge: number;
  fuel_surcharge: number;
  fixed_charge: number;
  meter_rent: number;
  green_tariff: number;
  electricity_duty: number;
  total: number;
  currency: string;
  data_source: DataSourceMode;
  tariff_version: number;
}

// ---- Alerts ----
export interface Alert {
  id: number;
  appliance_id?: string;
  appliance_name?: string;
  sensor_id?: string;
  device_id?: string;
  type: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  timestamp: string;
  resolved: boolean;
  actual_value?: number;
  expected_value?: number;
  deviation?: number;
}

// ---- Analytics ----
export interface DashboardSummary {
  total_power: number;
  total_energy_today: number;
  total_energy_week: number;
  total_energy_month: number;
  estimated_cost: number;
  peak_power: number;
  active_appliances: number;
  total_appliances: number;
  data_source: DataSourceMode;
  model_source: ModelSourceMode;
  active_alerts: number;
}

export interface ApplianceBreakdown {
  appliance_id: string;
  appliance_name: string;
  category: string;
  energy: number;
  percentage: number;
  power: number;
}

export interface EnergyTrend {
  time: string;
  energy: number;
  avg_power: number;
  peak_power: number;
}

// ---- Dataset ----
export interface DatasetInfo {
  id: number;
  name: string;
  source: DataSourceMode;
  file_path: string;
  row_count: number;
  appliance_count: number;
  features: string[];
  sampling_interval: string;
  date_range_start: string;
  date_range_end: string;
  size_bytes: number;
  created_at: string;
}

// ---- Reports ----
export interface ReportConfig {
  type: 'daily' | 'weekly' | 'monthly' | 'custom';
  from_date: string;
  to_date: string;
  appliance_ids?: string[];
  include_predictions: boolean;
  include_anomalies: boolean;
  include_billing: boolean;
}

// ---- System Status ----
export interface SystemStatus {
  status: 'online' | 'no_recent_telemetry';
  mode: DataSourceMode | 'unavailable';
  lastSync: string | null;
  backendUptimeSeconds: number;
  samplingIntervalMs: number;
  hardwareVerified: boolean;
}

// ---- User (preserve existing) ----
export interface User {
  id: number;
  username: string;
  email: string;
  role: 'operator' | 'analyst' | 'admin';
}

// ---- API Response Envelope ----
export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}
