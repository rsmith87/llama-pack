import { apiGet } from "./client";

export type ClientDiscoveryResponse = {
  product: "llama-pack";
  version: string;
  mode: string;
  capabilities: {
    openaiChatCompletions: boolean;
    streaming: boolean;
    localChatSessions: boolean;
    businessPlugin: boolean;
  };
  auth: {
    methods: string[];
    sessionHeader: string;
    apiKeyHeader: string;
  };
  endpoints: Record<string, string>;
};

export function getClientDiscovery() {
  return apiGet<ClientDiscoveryResponse>("/client-discovery");
}
