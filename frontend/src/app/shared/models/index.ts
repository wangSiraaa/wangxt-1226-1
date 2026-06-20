export interface User {
  id: number;
  username: string;
  email: string;
  full_name: string;
  is_active: boolean;
  created_at: string;
  last_login?: string;
  roles: UserRole[];
}

export interface UserRole {
  id: number;
  role: Role;
  assigned_at: string;
}

export interface Role {
  id: number;
  name: 'researcher' | 'warehouse' | 'qa' | 'admin';
  description?: string;
}

export type RoleName = 'researcher' | 'warehouse' | 'qa' | 'admin';

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: User;
  expires_in: number;
}

export type ProtocolStatus = 'draft' | 'approved' | 'in_progress' | 'completed' | 'cancelled';

export interface StorageCondition {
  id: number;
  protocol_id: number;
  condition_code: string;
  condition_name: string;
  temperature_min: number;
  temperature_max: number;
  temperature_target: number;
  humidity_min?: number;
  humidity_max?: number;
  humidity_target?: number;
  light_condition?: string;
  location: string;
  chamber_id?: string;
}

export interface SamplingTimepoint {
  id: number;
  protocol_id: number;
  timepoint_month: number;
  timepoint_label: string;
  planned_date: string;
  window_before_days: number;
  window_after_days: number;
  sample_count_per_condition: number;
  is_sampled: number;
  sampled_at?: string;
  created_at: string;
  updated_at: string;
}

export interface Protocol {
  id: number;
  protocol_code: string;
  title: string;
  product_name: string;
  batch_number: string;
  specification?: string;
  manufacturer?: string;
  package_type?: string;
  study_type: string;
  start_date: string;
  expected_end_date: string;
  total_duration_months: number;
  purpose?: string;
  testing_scope?: string;
  reference_standards?: string;
  status: ProtocolStatus;
  created_by: number;
  created_at: string;
  updated_at: string;
  approved_at?: string;
  approved_by?: number;
  storage_conditions: StorageCondition[];
  sampling_timepoints: SamplingTimepoint[];
}

export interface SamplingWindowInfo {
  timepoint_id: number;
  timepoint_label: string;
  planned_date: string;
  window_start: string;
  window_end: string;
  is_within_window: boolean;
  can_sample_now: boolean;
  days_until_window_start: number;
  is_urgent: boolean;
}

export type SampleStatus = 'pending' | 'in_storage' | 'in_sampling_window' | 'sampled' | 'testing' | 'tested' | 'locked' | 'discarded';
export type MovementType = 'in_chamber' | 'out_chamber' | 'transfer' | 'sampling' | 'return';

export interface SampleMovement {
  id: number;
  sample_id: number;
  movement_type: MovementType;
  from_location?: string;
  to_location?: string;
  occurred_at: string;
  operator_id: number;
  remarks?: string;
  temperature_at_movement?: string;
  humidity_at_movement?: string;
  created_at: string;
}

export interface SamplingRecord {
  id: number;
  sample_id: number;
  timepoint_id: number;
  sampled_at: string;
  operator_id: number;
  sampled_quantity: number;
  remaining_quantity?: number;
  out_chamber_time: string;
  return_chamber_time?: string;
  total_exposure_minutes?: number;
  is_within_window: boolean;
  window_deviation_note?: string;
  remarks?: string;
  attachments?: string;
  created_at: string;
}

export interface Sample {
  id: number;
  sample_code: string;
  protocol_id: number;
  storage_condition_id: number;
  batch_no?: string;
  container_no?: string;
  quantity: number;
  unit: string;
  status: SampleStatus;
  is_locked: boolean;
  lock_reason?: string;
  locked_at?: string;
  locked_by?: number;
  location?: string;
  chamber_position?: string;
  in_chamber_at?: string;
  last_movement_at?: string;
  created_at: string;
  updated_at: string;
  movements?: SampleMovement[];
  sampling_records?: SamplingRecord[];
}

export type AlertLevel = 'normal' | 'warning' | 'critical';

export interface EnvironmentRecord {
  id: number;
  chamber_id: string;
  condition_id?: number;
  recorded_at: string;
  temperature: number;
  humidity?: number;
  pressure?: number;
  light_intensity?: number;
  is_valid: boolean;
  temp_min_limit?: number;
  temp_max_limit?: number;
  humidity_min_limit?: number;
  humidity_max_limit?: number;
  temp_deviation: number;
  humidity_deviation: number;
  has_deviation: boolean;
  recorded_by?: number;
  remarks?: string;
  created_at: string;
}

export interface EnvironmentAlert {
  id: number;
  record_id?: number;
  chamber_id: string;
  alert_type: string;
  alert_level: AlertLevel;
  parameter_name: string;
  actual_value: number;
  expected_min?: number;
  expected_max?: number;
  deviation_amount?: number;
  start_time: string;
  end_time?: string;
  duration_minutes: number;
  is_acknowledged: boolean;
  acknowledged_by?: number;
  acknowledged_at?: string;
  acknowledge_remark?: string;
  has_deviation_report: boolean;
  deviation_id?: number;
  created_at: string;
}

export type ResultStatus = 'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected' | 'cancelled';

export interface TestItem {
  id: number;
  result_id: number;
  test_item_code: string;
  test_item_name: string;
  specification_limit?: string;
  result_value?: string;
  result_numeric?: number;
  unit?: string;
  is_conforming: boolean;
  is_oos: boolean;
  is_oot: boolean;
  remarks?: string;
}

export interface TestApproval {
  id: number;
  result_id: number;
  approval_type: string;
  approval_action: string;
  approver_id: number;
  approved_at: string;
  comments?: string;
  electronic_signature?: string;
}

export interface TestResult {
  id: number;
  result_code: string;
  sample_id: number;
  sampling_record_id: number;
  testing_date: string;
  testing_lab?: string;
  testing_method?: string;
  instrument_no?: string;
  analyst: string;
  overall_conclusion?: string;
  is_oos: boolean;
  is_oot: boolean;
  status: ResultStatus;
  created_by: number;
  created_at: string;
  updated_at: string;
  submitted_at?: string;
  items: TestItem[];
  approvals: TestApproval[];
}

export type DeviationStatus = 'reported' | 'under_investigation' | 'root_cause_identified' | 'implementing_capa' | 'completed' | 'closed' | 'cancelled';
export type DeviationCategory = 'temperature' | 'humidity' | 'sampling' | 'storage' | 'testing' | 'documentation' | 'other';
export type DeviationSeverity = 'minor' | 'major' | 'critical';

export interface AffectedSample {
  id: number;
  deviation_id: number;
  sample_id: number;
  impact_assessment?: string;
  impact_level?: string;
  disposition_decision?: string;
  disposition_rationale?: string;
  was_locked: boolean;
  locked_at?: string;
  created_at: string;
}

export interface DeviationConclusion {
  id: number;
  deviation_id: number;
  conclusion_type: string;
  conclusion_text: string;
  concluded_by: number;
  concluded_at: string;
  attachments?: string;
}

export interface Deviation {
  id: number;
  deviation_code: string;
  protocol_id?: number;
  category: DeviationCategory;
  severity: DeviationSeverity;
  title: string;
  description: string;
  discovery_date: string;
  occurrence_date?: string;
  occurrence_time?: string;
  chamber_id?: string;
  temp_deviation?: string;
  humidity_deviation?: string;
  deviation_duration_minutes?: number;
  reported_by: number;
  reported_at: string;
  handled_by?: number;
  assigned_at?: string;
  status: DeviationStatus;
  immediate_actions?: string;
  root_cause_analysis?: string;
  root_cause_category?: string;
  affected_product_impact?: string;
  patient_risk_assessment?: string;
  capa_plan?: string;
  effectiveness_check?: string;
  final_conclusion?: string;
  conclusion_date?: string;
  closed_by?: number;
  closed_at?: string;
  created_at: string;
  updated_at: string;
  affected_samples: AffectedSample[];
  conclusions: DeviationConclusion[];
}

export type NotificationType = 'sampling_reminder' | 'environment_alert' | 'deviation_reported' | 'deviation_assigned' | 'result_approval_request' | 'result_approved' | 'result_rejected' | 'sample_locked' | 'sample_unlocked' | 'system';

export interface Notification {
  id: number;
  user_id: number;
  notification_type: NotificationType;
  title: string;
  message: string;
  related_type?: string;
  related_id?: number;
  is_read: boolean;
  read_at?: string;
  priority: number;
  created_at: string;
}

export interface SelectOption<T = string> {
  label: string;
  value: T;
}
