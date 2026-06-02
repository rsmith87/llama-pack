import { createContext, useContext, type ReactNode } from "react";

export type AppMode = "agent" | "controller" | "";

type AppModeContextValue = {
  appMode: AppMode;
};

const AppModeContext = createContext<AppModeContextValue>({ appMode: "" });

export function AppModeProvider({ appMode, children }: { appMode: AppMode; children: ReactNode }) {
  return <AppModeContext.Provider value={{ appMode }}>{children}</AppModeContext.Provider>;
}

export function useAppMode(): AppMode {
  return useContext(AppModeContext).appMode;
}
