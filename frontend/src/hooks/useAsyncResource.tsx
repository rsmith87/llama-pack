import { useCallback, useEffect, useState } from "react";

export type AsyncResource<T> = {
  data: T;
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
  setError: React.Dispatch<React.SetStateAction<string>>;
};

/**
 * Standardizes the loading/error/data pattern repeated across pages
 * (DashboardPage, NodesPage, etc.).
 *
 * - `fetcher` is invoked once on mount and again whenever `refresh()` is
 *   called manually.
 * - `initialData` is the value of `data` before the first fetch resolves.
 * - On rejection, `error` is set to the thrown error's `message` (or
 *   `"Request failed"` for non-`Error` throws).
 * - `deps` controls the identity of the returned `refresh`; pass any external
 *   state the fetcher reads to get a fresh closure.
 */
export function useAsyncResource<T>(
  fetcher: () => Promise<T>,
  initialData: T,
  deps: ReadonlyArray<unknown> = [],
): AsyncResource<T> {
  const [data, setData] = useState<T>(initialData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await fetcher());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { data, loading, error, refresh, setError };
}
