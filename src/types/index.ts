export interface ParamBinding {
  name: string;
  source: 'static' | 'user_input' | 'prev_step';
  value: string;
  mapping: string;
}

export interface ApiEndpoint {
  id: string;
  name: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  description: string;
  microAppId?: string;
  domain?: string;
  category?: string;
  params?: Record<string, unknown>;
  external?: boolean;
  target_url?: string;
  link_only?: boolean;
  // 电网中台接口规范扩展
  version?: string;
  keywords?: string[];
  endpoint_config?: Record<string, unknown>;
  auth_config?: Record<string, unknown>;
  request_schema?: Record<string, unknown>;
  response_schema?: Record<string, unknown>;
  records_path?: string;
  fields?: Array<Record<string, unknown>>;
  transform?: Record<string, unknown>;
  retry?: Record<string, unknown>;
  error_mapping?: Array<Record<string, unknown>>;
  enabled?: boolean;
}

export interface FlowNode {
  type: 'sequence' | 'parallel' | 'api' | 'condition';
  steps?: FlowNode[];
  children?: FlowNode[];
  apiId?: string;
  label?: string;
  params?: ParamBinding[];
}

export interface MicroApp {
  id: string;
  name: string;
  description: string;
  app_type: 'query' | 'generation' | 'scheduled';
  domain?: string;
  status?: string;
  trigger?: string;
  input?: string;
  output?: string;
  interfaces: string[];
  flow?: FlowNode;
  skills?: string[];
  source: 'system' | 'user';
  created_at?: string;
  updated_at?: string;
  is_locked?: boolean;
  execution_count?: number;
  last_execution?: string | null;
  parent_app_id?: string | null;
  code?: string;
  skill_chain?: string[];
  render_config?: Record<string, unknown>;
  template_id?: string;
  favorite_id?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  relatedMicroApps?: string[];
  relatedApis?: string[];
  _streaming?: boolean;
}

export interface Favorite {
  id: string;
  type: 'conversation' | 'micro_app';
  title: string;
  content: Record<string, unknown>;
  created_at: string;
}

export interface ScheduleJob {
  id: string;
  micro_app_id: string;
  name: string;
  trigger_type: 'cron' | 'interval' | 'once';
  cron_expr?: string;
  interval_minutes?: number;
  next_run_time?: string;
  is_active: boolean;
  last_result?: Record<string, unknown>;
}

export interface SkillMeta {
  name: string;
  description: string;
  path: string;
  category?: string;
}

export interface SkillDetail {
  name: string;
  body?: string;
}

export interface DataSample {
  filename: string;
  domain: string;
  name: string;
}
