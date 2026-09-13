export interface FactoryMachine {
  machine_id: string;
  machine_name: string;
  stage: string;
  capacity_per_hour: number;
  operator: string;
  line_loss_rate: number;
  status: "NORMAL" | "WARNING" | "CRITICAL_SAFETY" | "STOPPED";
  current_throughput: number;
}

export interface ScenarioRecord {
  stage: string;
  machine_id: string;
  machine_name: string;
  capacity_per_hour: number;
  operator: string;
  line_loss_rate: number;
  error_id: string;
  failure_mode: string;
  category: "Mechanical" | "Electrical" | "Safety";
  symptom: string;
  planned_downtime_min: number;
  planned_part_cost: number;
  planned_labor_cost: number;
  unplanned_downtime_min: number;
  replacement_cost: number;
  freight_cost: number;
  idle_labor_cost: number;
  emergency_tech_cost: number;
  scrap_cost: number;
  safety_override: boolean;
}

export interface OptionACalculation {
  planned_downtime_min: number;
  production_loss: number;
  parts: number;
  labor: number;
  total: number;
}

export interface OptionBCalculation {
  unplanned_downtime_min: number;
  production_loss: number;
  replacement: number;
  freight: number;
  idle_labor: number;
  emergency_tech: number;
  scrap: number;
  total: number;
  locked_out: boolean;
  lockout_reason?: string;
}

export interface DecisionPackage {
  machine_id: string;
  machine_name: string;
  stage: string;
  operator: string;
  capacity_per_hour: number;
  error_id: string;
  failure_mode: string;
  category: string;
  symptom: string;
  line_loss_rate: number;
  option_a: OptionACalculation;
  option_b: OptionBCalculation;
  option_a_total: number;
  option_b_total: number;
  net_avoided_loss: number | null;
  safety_override: boolean;
}

export interface AuditLogItem {
  id: string;
  timestamp: string;
  machine_id: string;
  error_id: string;
  failure_mode: string;
  decision: "Accepted Option A (Intervene Now)" | "Deferred: Continue Running" | "Mandatory Safety Shutdown";
  net_avoided_loss: number;
  safety_override: boolean;
}

export interface AIExplanationResult {
  decision: string;
  why: string;
  financial_impact: string;
  risk: string;
  action: string;
  is_verified_grounded: boolean;
  source: "Groq API" | "Deterministic Grounded Fallback";
  notice?: string;
}

export interface FeatureImportanceItem {
  feature: string;
  importance: number;
  percentage: number;
  formatted: string;
}

export interface ModelThresholds {
  low_risk_max: number;
  medium_risk_max: number;
  decision_threshold: number;
}

export interface ModelMetrics {
  roc_auc: number;
  threshold: number;
  precision: number;
  recall: number;
  f1_score: number;
}

export interface ModelConfigData {
  model_name: string;
  model_type: string;
  dataset: string;
  dataset_records: number;
  thresholds: ModelThresholds;
  metrics: ModelMetrics;
  features: string[];
}

export interface PredictiveMaintenanceResult {
  probability: number;
  probability_pct: number;
  formatted_probability: string;
  risk_level: "LOW" | "MEDIUM" | "HIGH";
  risk_display: string;
  decision: "RUN NORMALLY" | "MONITOR" | "MAINTENANCE RECOMMENDED";
  priority: "P1" | "P2" | "P3";
  priority_label: string;
  recommendation: string;
  status_color: string;
  badge_variant: "low" | "medium" | "high";
  threshold: number;
  low_risk_threshold?: number;
  decision_threshold?: number;
}
