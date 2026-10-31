export type DashboardMode = 'DEMO' | 'LIVE_READ_ONLY';

export interface WorkflowStatus {
  id: string;
  name: string;
  code: 'WF-01' | 'WF-02' | 'WF-03';
  active: boolean;
  expected_state: 'INACTIVE_BY_DESIGN' | 'ACTIVE';
  mode: 'SYNTHETIC_SAFE' | 'LIVE_PRODUCTION';
  description: string;
  destination_table: string;
  destination_table_id: string;
}

export interface DataTableStatus {
  id: string;
  name: string;
  purpose: string;
  read_status:
    | 'AVAILABLE'
    | 'UNREACHABLE'
    | 'CREDENTIALS_REQUIRED'
    | 'SYNTHETIC_MOCK'
    | 'NOT_FOUND'
    | 'PERMISSION_DENIED'
    | 'EMPTY';
  rows_count?: number;
  last_queried?: string;
  error_message?: string;
}

export interface EnvironmentVariableStatus {
  name: string;
  is_set: boolean;
  required_for_live: boolean;
  description: string;
}

export interface SystemStatusData {
  connection_status: 'CONNECTED' | 'CREDENTIALS_MISSING' | 'ERROR' | 'SYNTHETIC_MODE' | 'PARTIAL';
  mode: DashboardMode;
  base_url: string;
  is_synthetic_mode: boolean;
  last_checked: string;
  response_time_ms?: number;
  error_message?: string;
  credentials_configured: boolean;
  authentication_validated: boolean;
  api_accessible: boolean;
  tables_queryable: boolean;
  real_data_loaded: boolean;
  workflows: WorkflowStatus[];
  tables: DataTableStatus[];
  env_variables: EnvironmentVariableStatus[];
}
