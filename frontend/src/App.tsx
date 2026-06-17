import { AuthSessionProvider } from "./features/auth/authSession";
import { ThemeProvider } from "./features/theme/themeSession";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { GlobalStatusProvider } from "./features/globalStatus/globalStatusContext";
import { LogModalProvider } from "./features/logs/logModalContext";
import { PluginNavProvider } from "./features/plugins/pluginNavContext";
import { AuthGate } from "./router/AuthGate";
import { AppLayout } from "./router/AppLayout";
import { DashboardPage } from "./pages/DashboardPage";
import { ChatPage } from "./pages/ChatPage";
import { SetupPage } from "./pages/SetupPage";
import { NodesPage } from "./pages/NodesPage";
import { ModelsPage } from "./pages/ModelsPage";
import { GgufLibraryPage } from "./pages/GgufLibraryPage";
import { HfToGgufPage } from "./pages/HfToGgufPage";
import { HfDownloadsPage } from "./pages/HfDownloadsPage";
import { QuantizationPage } from "./pages/QuantizationPage";
import { ControllerOpsPage } from "./pages/ControllerOpsPage";
import { EmbeddingsPage } from "./pages/EmbeddingsPage";
import { RuntimeOverviewPage } from "./pages/RuntimeOverviewPage";
import { ToolLoopEvalsPage } from "./pages/ToolLoopEvalsPage";
import { AuditPage } from "./pages/AuditPage";
import { BenchmarksPage } from "./pages/BenchmarksPage";
import { ApiKeysPage } from "./pages/ApiKeysPage";
import { PluginsPage } from "./pages/PluginsPage";
import { PluginHostPage } from "./pages/PluginHostPage";
import { SettingsPage } from "./pages/SettingsPage";
import { TestChatPage } from "./pages/TestChatPage";
import { DocsPage } from "./pages/DocsPage";

export default function App() {
  return (
    <ThemeProvider>
      <AuthSessionProvider>
        <BrowserRouter>
          <GlobalStatusProvider>
            <PluginNavProvider>
              <LogModalProvider>
                <Routes>
                  <Route element={<AuthGate />}>
                    <Route element={<AppLayout />}>
                      <Route path="/" element={<DashboardPage />} />
                      <Route path="/ui/chat" element={<ChatPage />} />
                      <Route path="/ui/setup" element={<SetupPage />} />
                      <Route path="/ui/nodes" element={<NodesPage />} />
                      <Route path="/ui/models" element={<ModelsPage />} />
                      <Route path="/ui/gguf-library" element={<GgufLibraryPage />} />
                      <Route path="/ui/hf-to-gguf" element={<HfToGgufPage />} />
                      <Route path="/ui/hf-downloads" element={<HfDownloadsPage />} />
                      <Route path="/ui/quantization" element={<QuantizationPage />} />
                      <Route path="/ui/controller-ops" element={<ControllerOpsPage />} />
                      <Route path="/ui/embeddings" element={<EmbeddingsPage />} />
                      <Route path="/ui/runtime" element={<RuntimeOverviewPage />} />
                      <Route path="/ui/tool-loop-evals" element={<ToolLoopEvalsPage />} />
                      <Route path="/ui/audit" element={<AuditPage />} />
                      <Route path="/ui/benchmarks" element={<BenchmarksPage />} />
                      <Route path="/ui/api-keys" element={<ApiKeysPage />} />
                      <Route path="/ui/plugins" element={<PluginsPage />} />
                      <Route path="/ui/plugins/:pluginId/*" element={<PluginHostPage />} />
                      <Route path="/ui/settings" element={<SettingsPage />} />
                    </Route>
                    <Route path="/ui/docs" element={<DocsPage />} />
                    <Route path="/ui/test-chat" element={<TestChatPage />} />
                  </Route>
                </Routes>
              </LogModalProvider>
            </PluginNavProvider>
          </GlobalStatusProvider>
        </BrowserRouter>
      </AuthSessionProvider>
    </ThemeProvider>
  );
}
