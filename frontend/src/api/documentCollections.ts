import { apiDelete, apiFormPost, apiGet, apiPatch, apiPost } from "./client";

export type DocumentCollectionRecord = {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  archived: boolean;
};

export type DocumentCollectionDocumentRecord = {
  id: string;
  collection_id: string;
  filename: string;
  content_type: string;
  status: string;
  chunk_count: number;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

export type DocumentCollectionDetail = DocumentCollectionRecord & {
  documents: DocumentCollectionDocumentRecord[];
};

export type DocumentCollectionSearchResult = {
  collection_id: string;
  collection_name: string;
  document_id: string;
  filename: string;
  chunk_id: string;
  chunk_index: number;
  text: string;
  score: number;
};

export type CreateDocumentCollectionRequest = {
  name: string;
  description: string | null;
};

export type UpdateDocumentCollectionRequest = {
  name: string;
  description: string | null;
};

export type SearchDocumentCollectionsRequest = {
  query: string;
  collection_ids: string[];
  top_k: number;
};

export function listDocumentCollections(includeArchived: boolean) {
  return apiGet<{ collections: DocumentCollectionRecord[] }>(
    `/document-collections?include_archived=${includeArchived ? "true" : "false"}`,
  );
}

export function createDocumentCollection(payload: CreateDocumentCollectionRequest) {
  return apiPost<DocumentCollectionRecord>("/document-collections", payload);
}

export function getDocumentCollection(collectionId: string) {
  return apiGet<DocumentCollectionDetail>(`/document-collections/${encodeURIComponent(collectionId)}`);
}

export function updateDocumentCollection(collectionId: string, payload: UpdateDocumentCollectionRequest) {
  return apiPatch<DocumentCollectionRecord>(`/document-collections/${encodeURIComponent(collectionId)}`, payload);
}

export function deleteDocumentCollection(collectionId: string) {
  return apiDelete<{ ok: boolean; deleted: boolean; id: string }>(`/document-collections/${encodeURIComponent(collectionId)}`);
}

export function listDocumentCollectionDocuments(collectionId: string) {
  return apiGet<{ documents: DocumentCollectionDocumentRecord[] }>(
    `/document-collections/${encodeURIComponent(collectionId)}/documents`,
  );
}

export function uploadDocumentCollectionFile(collectionId: string, file: File) {
  const form = new FormData();
  form.append("file", file);
  return apiFormPost<DocumentCollectionDocumentRecord>(
    `/document-collections/${encodeURIComponent(collectionId)}/documents`,
    form,
  );
}

export function searchDocumentCollections(payload: SearchDocumentCollectionsRequest) {
  return apiPost<{ results: DocumentCollectionSearchResult[]; count: number }>("/document-collections/search", payload);
}
