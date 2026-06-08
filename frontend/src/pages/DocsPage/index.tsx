import "./styles.css";
import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Link, useSearchParams } from "react-router-dom";
import { generatedDocs, type DocRecord } from "../../generated/docs";

function docIdFromParams(params: URLSearchParams): string {
  return params.get("doc") || "";
}

function resolveDoc(id: string): DocRecord {
  const found = generatedDocs.find((d) => d.id === id);
  return found || generatedDocs[0];
}

function searchDocs(query: string): DocRecord[] {
  if (!query.trim()) return generatedDocs;
  const q = query.toLowerCase();
  return generatedDocs.filter(
    (d) =>
      d.title.toLowerCase().includes(q) ||
      d.sourcePath.toLowerCase().includes(q) ||
      d.searchBody.toLowerCase().includes(q) ||
      d.headings.some((h) => h.text.toLowerCase().includes(q)),
  );
}

function snippet(doc: DocRecord, query: string): string {
  if (!query.trim()) return "";
  const q = query.toLowerCase();
  const idx = doc.searchBody.toLowerCase().indexOf(q);
  if (idx === -1) return "";
  const start = Math.max(0, idx - 40);
  const end = Math.min(doc.searchBody.length, idx + query.length + 80);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < doc.searchBody.length ? "…" : "";
  return `${prefix}${doc.searchBody.slice(start, end)}${suffix}`;
}

export function DocsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const activeId = docIdFromParams(searchParams);

  const activeDoc = useMemo(() => resolveDoc(activeId), [activeId]);
  const results = useMemo(() => searchDocs(query), [query]);

  function openDoc(id: string) {
    setQuery("");
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set("doc", id);
      return next;
    });
  }

  return (
    <div className="docs-shell">
      <aside className="docs-sidebar" aria-label="Documentation navigation">
        <div className="docs-brand">
          <Link to="/ui/setup" className="docs-back-link">← Back to app</Link>
          <h1 className="docs-brand-title">Neuraxis Docs</h1>
        </div>

        <div className="docs-search-wrap">
          <label htmlFor="docs-search" className="docs-search-label">Search docs</label>
          <input
            id="docs-search"
            type="search"
            className="docs-search-input"
            placeholder="Search…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search docs"
          />
        </div>

        <nav className="docs-nav" aria-label="Document list">
          {results.length === 0 ? (
            <p className="docs-nav-empty">No results for "{query}"</p>
          ) : results.map((doc) => (
            <div key={doc.id} className="docs-nav-item-wrap">
              <button
                type="button"
                className={`docs-nav-button ${doc.id === activeDoc.id && !query ? "active" : ""}`}
                onClick={() => openDoc(doc.id)}
                aria-current={doc.id === activeDoc.id && !query ? "page" : undefined}
              >
                <span className="docs-nav-title">{doc.title}</span>
                <span className="docs-nav-path">{doc.sourcePath}</span>
                {query && snippet(doc, query) ? (
                  <span className="docs-nav-snippet">{snippet(doc, query)}</span>
                ) : null}
              </button>
              {doc.id === activeDoc.id && !query && doc.headings.length > 0 ? (
                <ul className="docs-toc" aria-label="Table of contents">
                  {doc.headings.filter((h) => h.level <= 3).map((h) => (
                    <li key={`${h.anchor}-${h.level}`} className={`docs-toc-level-${h.level}`}>
                      <a href={`#${h.anchor}`} className="docs-toc-link">{h.text}</a>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ))}
        </nav>

        {generatedDocs.length === 0 ? (
          <p className="docs-empty-state">No public docs were generated. Run <code>node scripts/generate-docs.mjs</code> and rebuild.</p>
        ) : null}
      </aside>

      <main className="docs-main" aria-label="Documentation content">
        {generatedDocs.length === 0 ? (
          <div className="docs-empty-main">
            <h2>No docs available</h2>
            <p>Run the docs generator and rebuild the frontend to see documentation here.</p>
          </div>
        ) : (
          <article className="docs-article" aria-label={activeDoc.title}>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              disallowedElements={["script", "iframe", "object", "embed"]}
              unwrapDisallowed
              components={{
                h1: ({ children }) => <h1 id={headingId(String(children))}>{children}</h1>,
                h2: ({ children }) => <h2 id={headingId(String(children))}>{children}</h2>,
                h3: ({ children }) => <h3 id={headingId(String(children))}>{children}</h3>,
                h4: ({ children }) => <h4 id={headingId(String(children))}>{children}</h4>,
                h5: ({ children }) => <h5 id={headingId(String(children))}>{children}</h5>,
                h6: ({ children }) => <h6 id={headingId(String(children))}>{children}</h6>,
              }}
            >
              {activeDoc.content}
            </ReactMarkdown>
          </article>
        )}
      </main>
    </div>
  );
}

function headingId(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-");
}
