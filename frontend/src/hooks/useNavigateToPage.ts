import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { pageForKey, pathForPage, type PageDefinition, type PageKey, type PageNavigationOptions } from "../routes/pages";

/**
 * Returns a `navigateToPage(page, options?)` callback that resolves the page
 * definition via `pageForKey` (merged with any extra pages, e.g. plugin pages)
 * and calls `react-router-dom`'s `navigate` with the computed path.
 */
export function useNavigateToPage(extraPages: PageDefinition[] = []): (page: PageKey, options?: PageNavigationOptions) => void {
  const navigate = useNavigate();
  return useCallback(
    (page, options = {}) => {
      const target = pageForKey(page, extraPages);
      navigate(pathForPage(target, options));
    },
    [navigate, extraPages],
  );
}
