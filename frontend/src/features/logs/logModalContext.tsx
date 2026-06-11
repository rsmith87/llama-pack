import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { LogSelection } from "../../components/LogModal";

type LogModalContextValue = {
  isOpen: boolean;
  selection: LogSelection | null;
  openLogs: (selection?: Omit<LogSelection, "requestId">) => void;
  closeLogs: () => void;
};

const LogModalContext = createContext<LogModalContextValue>({
  isOpen: false,
  selection: null,
  openLogs: () => {},
  closeLogs: () => {},
});

export function LogModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [selection, setSelection] = useState<LogSelection | null>(null);

  const openLogs = useCallback((logSelection?: Omit<LogSelection, "requestId">) => {
    if (logSelection) {
      setSelection({ ...logSelection, requestId: Date.now() });
    }
    setIsOpen(true);
  }, []);

  const closeLogs = useCallback(() => {
    setIsOpen(false);
  }, []);

  const value = useMemo<LogModalContextValue>(() => ({
    isOpen,
    selection,
    openLogs,
    closeLogs,
  }), [isOpen, selection, openLogs, closeLogs]);

  return <LogModalContext.Provider value={value}>{children}</LogModalContext.Provider>;
}

export function useLogModal(): LogModalContextValue {
  return useContext(LogModalContext);
}