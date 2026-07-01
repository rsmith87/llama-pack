import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getRuntimeSettings } from "../../api/settings";
import { browserTimeZone, formatDateTime, normalizeDisplayTimeZone, type DateTimeDisplay } from "./dateTime";
import { useAuthSession } from "../auth/authSession";

type DateTimeContextValue = {
  timeZone: string;
  refreshDateTimeSettings: () => Promise<void>;
  formatConfiguredDateTime: (value: string | null | undefined) => DateTimeDisplay;
};

const fallbackTimeZone = browserTimeZone();

const DateTimeContext = createContext<DateTimeContextValue>({
  timeZone: fallbackTimeZone,
  refreshDateTimeSettings: async () => {},
  formatConfiguredDateTime: (value: string | null | undefined) => formatDateTime(value, fallbackTimeZone),
});

export function DateTimeProvider({ children }: { children: ReactNode }) {
  const { authToken } = useAuthSession();
  const [timeZone, setTimeZone] = useState(fallbackTimeZone);

  const refreshDateTimeSettings = useCallback(async () => {
    const payload = await getRuntimeSettings();
    setTimeZone(normalizeDisplayTimeZone(payload.settings.display_timezone));
  }, []);

  useEffect(() => {
    if (!authToken) return;
    void refreshDateTimeSettings();
  }, [authToken, refreshDateTimeSettings]);

  const value = useMemo<DateTimeContextValue>(() => ({
    timeZone,
    refreshDateTimeSettings,
    formatConfiguredDateTime: (timestamp: string | null | undefined) => formatDateTime(timestamp, timeZone),
  }), [refreshDateTimeSettings, timeZone]);

  return <DateTimeContext.Provider value={value}>{children}</DateTimeContext.Provider>;
}

export function useDateTime(): DateTimeContextValue {
  return useContext(DateTimeContext);
}
