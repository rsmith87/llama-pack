export type LoginRequest = {
  username: string;
  api_key: string;
};

export type LoginResponse = {
  token: string;
  username: string;
  expires_at: string;
  role: string;
};

export type CurrentUserResponse = {
  username: string;
  created_at: string;
  role: string;
};

export type BootstrapAdminResponse = LoginResponse & {
  key: string;
  key_hint?: string;
};

export type AuthKey = {
  id?: string;
  username?: string;
  role?: string;
  hint?: string;
  revoked?: boolean;
  created_at?: string;
};

export type ExternalApiKey = {
  id?: string;
  site_name?: string;
  site_url?: string;
  key_hint?: string;
  revoked?: boolean;
  created_at?: string;
  last_used_at?: string;
  last_used_endpoint?: string;
  last_used_route?: string;
  last_used_node?: string;
  last_used_model?: string;
  last_used_request_type?: string;
};

export type ExternalApiKeyCreated = ExternalApiKey & { key?: string };

export type ExternalApiKeyAnalytics = {
  key_id?: string;
  site_name?: string;
  total_calls?: number;
  endpoint_counts?: Record<string, number>;
  model_counts?: Record<string, number>;
  route_counts?: Record<string, number>;
  request_type_counts?: Record<string, number>;
  recent_calls?: Array<{
    created_at?: string;
    endpoint?: string;
    request_type?: string;
    route?: string;
    node?: string;
    model?: string;
    stream?: boolean;
  }>;
};
