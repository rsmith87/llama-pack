import "./layout.css";
import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { AppModeProvider } from "../features/appMode/appModeContext";
import { AuthLoginForm, useAuthSession } from "../features/auth/authSession";
import { ThemeToggle } from "../features/theme/themeSession";
import { useGlobalStatus } from "../features/globalStatus/globalStatusContext";
import { usePluginNav } from "../features/plugins/pluginNavContext";
import { useLogModal } from "../features/logs/logModalContext";
import { pageForCurrentPath, pagesBySectionForMode } from "../routes/pages";
import { LogModal } from "../components/LogModal";
import { Button } from "../components/ui";
import { MenuIcon } from "../components/MenuIcon";
import { BrandLogo } from "../components/BrandLogo";
import headerLogoUrl from "../images/llama-pack-logo.png";
import { IoRefreshSharp } from "react-icons/io5";
import { NavSidebar } from "./NavSidebar";

export function AppLayout() {
  const { appMode, status, refreshKey, globalRefreshing, refreshGlobal } = useGlobalStatus();
  const { pluginPages, pluginStatusIssues } = usePluginNav();
  const { isOpen: logsOpen, selection: logSelection, closeLogs } = useLogModal();
  const { authEnabled, setupStatusPending, isAuthenticated } = useAuthSession();
  const location = useLocation();
  const navigate = useNavigate();

  const [navOpen, setNavOpen] = useState(false);
  const activePage = pageForCurrentPath(location.pathname, pluginPages);

  // Visible pages for mode-based redirect
  const visiblePages = pagesBySectionForMode(appMode, pluginPages)
    .flatMap((section) => section.pages);

  // Close mobile nav on route change
  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname]);

  // Body class for mobile nav
  useEffect(() => {
    document.body.classList.toggle("nav-open", navOpen);
    return () => document.body.classList.remove("nav-open");
  }, [navOpen]);

  // Redirect away from hidden pages
  useEffect(() => {
    if (appMode && !visiblePages.some((page) => page.key === activePage.key)) {
      if (activePage.pluginId) return;
      if (activePage.key !== "dashboard") navigate("/", { replace: true });
    }
  }, [activePage.key, appMode, visiblePages, navigate]);

  const authRequired = authEnabled === true;

  // When auth is enabled but the user has no session, show only the login
  // form — no sidebar, header chrome, or page content.
  if (!setupStatusPending && authRequired && !isAuthenticated) {
    return (
      <div className="login-required-screen">
        <div className="login-required-card">
          <div className="brand-lockup">
            <span className="brand-mark">
              <BrandLogo />
            </span>
            <div>
              <h1>Llama Pack</h1>
              <p>Log in to continue</p>
            </div>
          </div>
          <AuthLoginForm />
          <ThemeToggle />
        </div>
      </div>
    );
  }

  return (
    <AppModeProvider appMode={appMode}>
      <div className={`app-shell ${appMode}-mode ${navOpen ? "mobile-nav-open" : ""}`}>
        <NavSidebar activePage={activePage} onClose={() => setNavOpen(false)} />
        <div className="app-main">
          <header className="app-header">
            <button
              className="mobile-menu-button"
              type="button"
              aria-label={navOpen ? "Close navigation menu" : "Open navigation menu"}
              aria-expanded={navOpen}
              onClick={() => setNavOpen((open) => !open)}
            >
              <MenuIcon icon={navOpen ? "close" : "menu"} />
            </button>
            <div className="command-center">
              <span className="command-icon" aria-hidden="true"><img src={headerLogoUrl} className="brand-logo" /></span>
              <span className="command-copy">{activePage.label}</span>
            </div>
            <div className="global-status">
              <span className={`status-dot ${status === "Backend online" ? "online" : status === "Backend offline" ? "offline" : ""}`} aria-hidden="true" />
              <span>{status}</span>
              <Button type="button" onClick={() => void refreshGlobal()} disabled={globalRefreshing} aria-label={globalRefreshing ? "Refreshing" : "Global Refresh"}>
                {globalRefreshing ? "Refreshing" : <IoRefreshSharp />}
              </Button>
            </div>
            <div className="header-actions">
              <AuthLoginForm />
              <ThemeToggle />
            </div>
          </header>
          <main className="layout" key={`${activePage.key}-${refreshKey}`}>
            {pluginStatusIssues.length ? (
              <section className="plugin-status-alert" role="alert" aria-label="Plugin status">
                <strong>Plugin attention needed</strong>
                <ul>
                  {pluginStatusIssues.map((issue) => <li key={issue}>{issue}</li>)}
                </ul>
              </section>
            ) : null}
            {activePage.pluginId && activePage.secondaryNavigation?.length ? (
              <nav className="plugin-secondary-nav" aria-label={`${activePage.pluginName || activePage.label} navigation`}>
                {activePage.secondaryNavigation.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={({ isActive }) => `plugin-secondary-button ${isActive ? "active" : ""}`}
                    end
                  >
                    {item.label}
                  </NavLink>
                ))}
              </nav>
            ) : null}
            {setupStatusPending ? (
              <div className="muted" data-testid="auth-gate-pending">Checking session...</div>
            ) : (
              <Outlet />
            )}
          </main>
        </div>
        {navOpen ? <button className="mobile-nav-scrim" type="button" aria-label="Close navigation overlay" onClick={() => setNavOpen(false)} /> : null}
        <LogModal open={logsOpen} onClose={closeLogs} initialSelection={logSelection} />
      </div>
    </AppModeProvider>
  );
}
