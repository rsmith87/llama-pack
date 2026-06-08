import { AppShell } from "../components/AppShell";
import { DashboardPage } from "../pages/DashboardPage";
import { ChatPage } from "../pages/ChatPage";
import { NodesPage } from "../pages/NodesPage";
import { GgufLibraryPage } from "../pages/GgufLibraryPage";
import { HfToGgufPage } from "../pages/HfToGgufPage";
import { HfDownloadsPage } from "../pages/HfDownloadsPage";
import { QuantizationPage } from "../pages/QuantizationPage";
import { ControllerOpsPage } from "../pages/ControllerOpsPage";
import { EmbeddingsPage } from "../pages/EmbeddingsPage";
import { RuntimeOverviewPage } from "../pages/RuntimeOverviewPage";
import { AuditPage } from "../pages/AuditPage";
import { BenchmarksPage } from "../pages/BenchmarksPage";
import { ApiKeysPage } from "../pages/ApiKeysPage";
import { PluginHostPage } from "../pages/PluginHostPage";
import { PluginsPage } from "../pages/PluginsPage";
import { SettingsPage } from "../pages/SettingsPage";
import { SetupPage } from "../pages/SetupPage";

type LegacyShellRouteProps = {
  authRefreshKey: string;
};

export function LegacyShellRoute({ authRefreshKey }: LegacyShellRouteProps) {
  return (
    <AppShell
      authRefreshKey={authRefreshKey}
      renderPage={(page, setPage, refreshKey, openLogs) => {
        if (page.key === "dashboard") {
          return <DashboardPage onOpenLogs={openLogs} />;
        }
        if (page.key === "chat") {
          return <ChatPage />;
        }
        if (page.key === "setup") {
          return <SetupPage />;
        }
        if (page.key === "nodes") {
          return <NodesPage onOpenLogs={openLogs} />;
        }
        if (page.key === "gguf-library") {
          return <GgufLibraryPage onNavigate={setPage} />;
        }
        if (page.key === "hf-to-gguf") {
          return <HfToGgufPage />;
        }
        if (page.key === "hf-downloads") {
          return <HfDownloadsPage />;
        }
        if (page.key === "quantization") {
          return <QuantizationPage />;
        }
        if (page.key === "controller-ops") {
          return <ControllerOpsPage />;
        }
        if (page.key === "embeddings") {
          return <EmbeddingsPage />;
        }
        if (page.key === "runtime-overview") {
          return <RuntimeOverviewPage onNavigate={setPage} />;
        }
        if (page.key === "audit") {
          return <AuditPage />;
        }
        if (page.key === "benchmarks") {
          return <BenchmarksPage />;
        }
        if (page.key === "api-keys") {
          return <ApiKeysPage />;
        }
        if (page.key === "plugins") {
          return <PluginsPage />;
        }
        if (page.key === "settings") {
          return <SettingsPage />;
        }
        if (page.pluginId) {
          return <PluginHostPage page={page} onNavigate={setPage} refreshKey={refreshKey} />;
        }
        return <DashboardPage onOpenLogs={openLogs} />;
      }}
    />
  );
}
