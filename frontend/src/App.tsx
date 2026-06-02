import { AppShell } from "./components/AppShell";
import { AuthSessionProvider, useAuthSession } from "./features/auth/authSession";
import { ThemeProvider } from "./features/theme/themeSession";
import { DashboardPage } from "./pages/DashboardPage";
import { ChatPage } from "./pages/ChatPage";
import { NodesPage } from "./pages/NodesPage";
import { GgufLibraryPage } from "./pages/GgufLibraryPage";
import { HfToGgufPage } from "./pages/HfToGgufPage";
import { HfDownloadsPage } from "./pages/HfDownloadsPage";
import { QuantizationPage } from "./pages/QuantizationPage";
import { ControllerOpsPage } from "./pages/ControllerOpsPage";
import { EmbeddingsPage } from "./pages/EmbeddingsPage";
import { RuntimeOverviewPage } from "./pages/RuntimeOverviewPage";
import { AuditPage } from "./pages/AuditPage";
import { BenchmarksPage } from "./pages/BenchmarksPage";
import { ApiKeysPage } from "./pages/ApiKeysPage";
import { SettingsPage } from "./pages/SettingsPage";
import { SetupPage } from "./pages/SetupPage";
import { TestChatPage } from "./pages/TestChatPage";

function RoutedApp() {
  const { authToken } = useAuthSession();
  if (window.location.pathname === "/ui/test-chat") {
    return <TestChatPage />;
  }
  return (
    <AppShell
      authRefreshKey={authToken}
      renderPage={(page, setPage, _refreshKey, openLogs) => {
        if (page.key === "dashboard") {
          return <DashboardPage onNavigate={setPage} onOpenLogs={openLogs} />;
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
        if (page.key === "settings") {
          return <SettingsPage />;
        }
        return <DashboardPage onNavigate={setPage} onOpenLogs={openLogs} />;
      }}
    />
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthSessionProvider>
        <RoutedApp />
      </AuthSessionProvider>
    </ThemeProvider>
  );
}
