import { useCallback, useMemo, useState, type ReactElement } from "react";
import "./styles.css";
import { IoChevronBack, IoChevronForward } from "react-icons/io5";

export type ModelCarouselProps = {
  /** List of items to display, one per slide. */
  items: unknown[];
  /** Render function for each item. */
  renderItem: (item: unknown, index: number) => ReactElement;
  /** Override the number of slides shown at once (default 1). */
  slidesPerView?: number;
  /** Optional className for the root element. */
  className?: string;
};

/**
 * A carousel component that wraps a list of items in panes with
 * left/right navigation arrows and pagination dots.
 *
 * Each pane displays up to `slidesPerView` items in a CSS grid with
 * a gap, so cards are evenly spaced without manual margins.
 *
 * Example usage:
 * ```tsx
 * <ModelCarousel items={models} slidesPerView={3} renderItem={(model) => <ModelCard model={model} />} />
 * ```
 */
export function ModelCarousel({
  items,
  renderItem,
  slidesPerView = 1,
  className = "",
}: ModelCarouselProps) {
  const [currentPane, setCurrentPane] = useState(0);

  // Group items into panes of slidesPerView
  const panes = useMemo(() => {
    const result: unknown[][] = [];
    for (let i = 0; i < items.length; i += slidesPerView) {
      result.push(items.slice(i, i + slidesPerView));
    }
    return result;
  }, [items, slidesPerView]);

  const paneCount = panes.length;
  const maxPane = Math.max(0, paneCount - 1);

  const goNext = useCallback(() => {
    setCurrentPane((prev) => Math.min(prev + 1, maxPane));
  }, [maxPane]);

  const goPrev = useCallback(() => {
    setCurrentPane((prev) => Math.max(prev - 1, 0));
  }, []);

  const goTo = useCallback(
    (index: number) => {
      setCurrentPane(Math.max(0, Math.min(index, maxPane)));
    },
    [maxPane],
  );

  const canGoPrev = currentPane > 0;
  const canGoNext = currentPane < maxPane;

  if (paneCount === 0) {
    return null;
  }

  return (
    <div className={`model-carousel ${className}`.trim()}>
      <div className="model-carousel-viewport">
        <div
          className="model-carousel-track"
          style={{
            width: `${paneCount * 100}%`,
            transform: `translateX(-${(currentPane / paneCount) * 100}%)`,
          }}
        >
          {panes.map((pane, paneIndex) => (
            <div
              className="model-carousel-pane"
              key={paneIndex}
              style={{
                width: `${100 / paneCount}%`,
                gridTemplateColumns: `repeat(${slidesPerView}, 1fr)`,
              }}
            >
              {pane.map((item, itemIndex) => (
                <div key={itemIndex} className="model-carousel-pane-item">
                  {renderItem(item, currentPane * slidesPerView + itemIndex)}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="model-carousel-controls">
        <button
          type="button"
          className="model-carousel-arrow"
          onClick={goPrev}
          disabled={!canGoPrev}
          aria-label="Previous slide"
        >
          <IoChevronBack />
        </button>

        <div className="model-carousel-dots">
          {panes.map((_, paneIndex) => (
            <button
              key={paneIndex}
              type="button"
              className={`model-carousel-dot ${paneIndex === currentPane ? "active" : ""}`.trim()}
              onClick={() => goTo(paneIndex)}
              aria-label={`Go to slide ${paneIndex + 1}`}
            />
          ))}
        </div>

        <button
          type="button"
          className="model-carousel-arrow"
          onClick={goNext}
          disabled={!canGoNext}
          aria-label="Next slide"
        >
          <IoChevronForward />
        </button>
      </div>
    </div>
  );
}
