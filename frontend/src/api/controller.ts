import { apiGet, apiPost, apiStream } from "./client";
import type { ControllerStatsResponse, JobsResponse, RetentionPolicyResponse } from "../types/api";

export function createJob(payload: Record<string, unknown>) { return apiPost<Record<string, unknown>>("/jobs", payload); }
export function listJobs(limit?: number) { return apiGet<JobsResponse>(limit ? `/jobs?limit=${limit}` : "/jobs"); }
export function getJob(jobId: string) { return apiGet<Record<string, unknown>>(`/jobs/${encodeURIComponent(jobId)}`); }
export function cancelJob(jobId: string) { return apiPost<Record<string, unknown>>(`/jobs/${encodeURIComponent(jobId)}/cancel`); }
export function getJobEvents(jobId: string, limit = 200) { return apiGet<Array<Record<string, unknown>>>(`/jobs/${encodeURIComponent(jobId)}/events?limit=${limit}`); }
export function getJobArtifacts(jobId: string) { return apiGet<Array<Record<string, unknown>>>(`/jobs/${encodeURIComponent(jobId)}/artifacts`); }
export function getControllerStats() { return apiGet<ControllerStatsResponse>("/controller/stats"); }
export function getRetentionPolicy() { return apiGet<RetentionPolicyResponse>("/controller/retention-policy"); }
export function exportArchive(payload?: Record<string, unknown>) { return apiPost<Record<string, unknown>>("/controller/archive/export", payload); }
export function streamJobEvents(jobId: string) { return apiStream(`/jobs/${encodeURIComponent(jobId)}/events/stream`); }
