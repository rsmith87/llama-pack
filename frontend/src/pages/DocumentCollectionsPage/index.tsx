import "./styles.css";
import { useEffect, useMemo, useState } from "react";
import {
  createDocumentCollection,
  deleteDocumentCollection,
  getDocumentCollection,
  listDocumentCollections,
  searchDocumentCollections,
  uploadDocumentCollectionFile,
  type DocumentCollectionDocumentRecord,
  type DocumentCollectionRecord,
  type DocumentCollectionSearchResult,
} from "../../api/documentCollections";
import { Button, ErrorBanner, FormField, Panel, StatusBadge } from "../../components/ui";

function statusTone(status: string): "success" | "warning" | "danger" | "muted" {
  if (status === "indexed") return "success";
  if (status === "failed") return "danger";
  if (status === "pending") return "warning";
  return "muted";
}

export function DocumentCollectionsPage() {
  const [collections, setCollections] = useState<DocumentCollectionRecord[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [documents, setDocuments] = useState<DocumentCollectionDocumentRecord[]>([]);
  const [results, setResults] = useState<DocumentCollectionSearchResult[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [query, setQuery] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("Ready");
  const [loading, setLoading] = useState(false);

  const selectedCollection = useMemo(
    () => collections.find((collection) => collection.id === selectedId) || collections[0] || null,
    [collections, selectedId],
  );

  async function loadCollections(): Promise<void> {
    setLoading(true);
    setError("");
    try {
      const payload = await listDocumentCollections(false);
      setCollections(payload.collections);
      if (!selectedId && payload.collections.length > 0) setSelectedId(payload.collections[0].id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load collections");
    } finally {
      setLoading(false);
    }
  }

  async function loadSelectedCollection(collectionId: string): Promise<void> {
    setError("");
    try {
      const detail = await getDocumentCollection(collectionId);
      setDocuments(detail.documents);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load collection documents");
    }
  }

  useEffect(() => {
    void loadCollections();
  }, []);

  useEffect(() => {
    if (!selectedCollection) {
      setDocuments([]);
      return;
    }
    if (selectedCollection.id !== selectedId) setSelectedId(selectedCollection.id);
    void loadSelectedCollection(selectedCollection.id);
  }, [selectedCollection, selectedId]);

  async function handleCreate(): Promise<void> {
    const trimmedName = name.trim();
    const trimmedDescription = description.trim();
    if (!trimmedName) {
      setError("Collection name is required.");
      return;
    }
    setStatus("Creating collection...");
    setError("");
    try {
      const created = await createDocumentCollection({ name: trimmedName, description: trimmedDescription || null });
      setName("");
      setDescription("");
      setSelectedId(created.id);
      await loadCollections();
      setStatus("Collection created.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create collection");
      setStatus("Ready");
    }
  }

  async function handleUpload(): Promise<void> {
    if (!selectedCollection || !selectedFile) return;
    setStatus("Uploading document...");
    setError("");
    try {
      await uploadDocumentCollectionFile(selectedCollection.id, selectedFile);
      setSelectedFile(null);
      await loadSelectedCollection(selectedCollection.id);
      setStatus("Document indexed.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to upload document");
      setStatus("Ready");
    }
  }

  async function handleSearch(): Promise<void> {
    if (!selectedCollection) return;
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      setError("Search query is required.");
      return;
    }
    setStatus("Searching...");
    setError("");
    try {
      const payload = await searchDocumentCollections({
        query: trimmedQuery,
        collection_ids: [selectedCollection.id],
        top_k: 5,
      });
      setResults(payload.results);
      setStatus(`${payload.count} result${payload.count === 1 ? "" : "s"}.`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to search collection");
      setStatus("Ready");
    }
  }

  async function handleDeleteCollection(): Promise<void> {
    if (!selectedCollection) return;
    setStatus("Deleting collection...");
    setError("");
    try {
      await deleteDocumentCollection(selectedCollection.id);
      setSelectedId("");
      setDocuments([]);
      setResults([]);
      await loadCollections();
      setStatus("Collection deleted.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete collection");
      setStatus("Ready");
    }
  }

  return (
    <main className="document-collections-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">Knowledge</span>
          <h2>Collections</h2>
        </div>
        <StatusBadge tone={loading ? "warning" : "muted"}>{status}</StatusBadge>
      </div>
      {error ? <ErrorBanner message={error} /> : null}

      <div className="collections-layout">
        <Panel title="Collections" eyebrow="Libraries">
          <div className="collection-list" data-testid="document-collection-list">
            {collections.map((collection) => (
              <button
                key={collection.id}
                type="button"
                className={`collection-row ${collection.id === selectedCollection?.id ? "active" : ""}`}
                onClick={() => setSelectedId(collection.id)}
              >
                <strong>{collection.name}</strong>
                <span>{collection.description || "No description"}</span>
              </button>
            ))}
            {collections.length === 0 ? <p className="muted">No collections yet.</p> : null}
          </div>
          <div className="create-collection-form">
            <FormField label="Name">
              <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Home Repairs" />
            </FormField>
            <FormField label="Description">
              <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Manuals, warranties, contractor notes" rows={3} />
            </FormField>
            <Button type="button" variant="primary" onClick={handleCreate}>Create</Button>
          </div>
        </Panel>

        <Panel
          title={selectedCollection?.name || "Select a collection"}
          eyebrow="Documents"
          actions={selectedCollection ? <Button type="button" variant="danger" onClick={handleDeleteCollection}>Delete</Button> : null}
        >
          {selectedCollection ? (
            <>
              <div className="upload-row">
                <input
                  aria-label="Document file"
                  type="file"
                  accept=".txt,.md,text/plain,text/markdown"
                  onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
                />
                <Button type="button" variant="primary" disabled={!selectedFile} onClick={handleUpload}>Upload</Button>
              </div>
              <div className="document-table">
                {documents.map((document) => (
                  <div className="document-row" key={document.id}>
                    <div>
                      <strong>{document.filename}</strong>
                      <span>{document.chunk_count} chunks</span>
                    </div>
                    <StatusBadge tone={statusTone(document.status)}>{document.status}</StatusBadge>
                  </div>
                ))}
                {documents.length === 0 ? <p className="muted">No documents indexed.</p> : null}
              </div>
            </>
          ) : (
            <p className="muted">Create or select a collection.</p>
          )}
        </Panel>

        <Panel title="Search" eyebrow="Collection search" className="search-panel">
          <div className="search-row">
            <FormField label="Query">
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="What warranty do we have on the dishwasher?" />
            </FormField>
            <Button type="button" variant="primary" disabled={!selectedCollection} onClick={handleSearch}>Search</Button>
          </div>
          <div className="search-results">
            {results.map((result) => (
              <article className="search-result" key={result.chunk_id}>
                <div className="result-meta">
                  <strong>{result.filename}</strong>
                  <span>{result.collection_name} / chunk {result.chunk_index} / score {result.score.toFixed(2)}</span>
                </div>
                <p>{result.text}</p>
              </article>
            ))}
            {results.length === 0 ? <p className="muted">No search results.</p> : null}
          </div>
        </Panel>
      </div>
    </main>
  );
}
