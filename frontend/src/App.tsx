import { AuthSessionProvider, useAuthSession } from "./features/auth/authSession";
import { ThemeProvider } from "./features/theme/themeSession";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { TestChatPage } from "./pages/TestChatPage";
import { DocsPage } from "./pages/DocsPage";
import { LegacyShellRoute } from "./router/LegacyShellRoute";

function RoutedApp() {
  const { authToken } = useAuthSession();
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/ui/docs" element={<DocsPage />} />
        <Route path="/ui/test-chat" element={<TestChatPage />} />
        <Route path="*" element={<LegacyShellRoute authRefreshKey={authToken} />} />
      </Routes>
    </BrowserRouter>
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
