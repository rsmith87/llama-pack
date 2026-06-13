import { useState, type ReactElement } from "react";
import "./with-search.css";
import {
  ModelCarousel,
  type ModelCarouselProps,
} from "./index";

export type ModelCarouselWithSearchProps = ModelCarouselProps & {
  /** Returns the string fields to search against for each item. */
  searchFields: (item: unknown) => string[];
  /** Placeholder text for the search input. */
  placeholder?: string;
};

/**
 * Wraps `ModelCarousel` with a search/filter input.
 *
 * When the user types, items are filtered client-side using the
 * `searchFields` callback. Clicking the X (or clearing the input)
 * restores the full list.
 *
 * ```tsx
 * <ModelCarouselWithSearch
 *   items={available}
 *   slidesPerView={3}
 *   searchFields={(item) => {
 *     const f = item as GgufFile;
 *     return [fileName(f), f.path ?? "", f.model_dir ?? ""];
 *   }}
 *   renderItem={(item) => renderCard(item as GgufFile)}
 * />
 * ```
 */
export function ModelCarouselWithSearch({
  items,
  renderItem,
  slidesPerView = 1,
  className = "",
  searchFields,
  placeholder = "Search…",
}: ModelCarouselWithSearchProps) {
  const [query, setQuery] = useState("");

  const trimmed = query.trim().toLowerCase();

  const filtered = trimmed
    ? items.filter((item) =>
        searchFields(item).some((field) =>
          String(field).toLowerCase().includes(trimmed),
        ),
      )
    : items;

  return (
    <div className={`model-carousel-search ${className}`.trim()}>
      <div className="model-carousel-search-bar">
        <input
          className="model-carousel-search-input"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
        />
        {query && (
          <button
            type="button"
            className="model-carousel-search-clear"
            onClick={() => setQuery("")}
            aria-label="Clear search"
          >
            ×
          </button>
        )}
      </div>

      {filtered.length > 0 ? (
        <ModelCarousel
          items={filtered}
          slidesPerView={slidesPerView}
          renderItem={renderItem}
        />
      ) : (
        <div className="model-carousel-search-empty">No results.</div>
      )}
    </div>
  );
}