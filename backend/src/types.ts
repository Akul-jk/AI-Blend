export enum DataSource {
  SIMULATION = 'simulation',
  HARDWARE = 'hardware'
}

export interface TelemetryReading {
  timestamp: string;
  pzem_id: string | null;
  appliance_id: number | null;
  voltage: number;
  current: number;
  power: number;
  /** Cumulative meter register in kWh. */
  energy: number;
  /** Derived kWh consumed since the prior valid reading on this meter. */
  interval_energy_kwh?: number | null;
  quality?: 'valid' | 'baseline' | 'counter_reset' | 'energy_jump';
  received_at?: string;
  frequency: number;
  power_factor: number;
  source: DataSource;
  device_id?: string;
  circuit_id?: number;
}

export interface Appliance {
  id: number;
  name: string;
  category: string;
  manufacturer: string;
  model: string;
  serial_number: string;
  description: string;
  location: string;
  image_url: string;
  pzem_id: string | null;
  circuit_id: number | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface ApplianceRating {
  id: number;
  appliance_id: number;
  rated_voltage: number;
  rated_current: number;
  rated_power: number;
  rated_frequency: number;
  rated_power_factor: number;
  standby_power: number;
}

export interface ApplianceCategory {
  id: number;
  name: string;
  icon: string;
  default_power_range: string;
}

export interface PzemDevice {
  id: string;
  address: string;
  esp32_device_id: string;
  status: string;
  last_seen: string;
}

export interface Esp32Device {
  id: string;
  name: string;
  ip_address: string;
  firmware_version: string;
  status: string;
  last_seen: string;
}

export interface Circuit {
  id: number;
  name: string;
  pzem_id: string | null;
  description: string;
  location: string;
}

export interface Prediction {
  id: number;
  appliance_id: number | null;
  timestamp: string;
  predicted_power: number;
  confidence: number;
}

export interface Anomaly {
  id: number;
  appliance_id: number | null;
  timestamp: string;
  anomaly_type: string;
  description: string;
  severity: string;
  resolved: boolean;
}

export interface TrainingRun {
  id: number;
  model_name: string;
  status: string;
  accuracy: number | null;
  loss: number | null;
  started_at: string;
  completed_at: string | null;
}

export interface Tariff {
  id: number;
  name: string;
  type: string;
  fixed_charge: number;
  meter_rent: number;
  fuel_surcharge: number;
  electricity_duty_percent: number;
  green_tariff_optional: number;
}

export interface TariffSlab {
  id: number;
  tariff_id: number;
  is_telescopic: boolean;
  min_units: number;
  max_units: number | null;
  rate: number;
}

export interface BillCalculation {
  total_units: number;
  energy_charge: number;
  fixed_charge: number;
  meter_rent: number;
  fuel_surcharge: number;
  electricity_duty: number;
  green_charge: number;
  total_bill: number;
  slabs_breakdown: Array<{ range: string; units: number; rate: number; charge: number }>;
}
