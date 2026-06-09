import "../components/AppShell/styles.css";
import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { AppModeProvider } from "../features/appMode/appModeContext";
import { AuthLoginForm } from "../features/auth/authSession";
import { ThemeToggle } from "../features/theme/themeSession";
import { useGlobalStatus } from "../features/globalStatus/globalStatusContext";
import { usePluginNav } from "../features/plugins/pluginNavContext";
import { useLogModal } from "../features/logs/logModalContext";
import { pageForPath, pagesBySectionForMode, type PageDefinition } from "../routes/pages";
import { LogModal } from "../components/LogModal";
import { Button } from "../components/ui";
import { MenuIcon } from "../components/MenuIcon";
import { BrandLogo } from "../components/BrandLogo";
import { IoRefreshSharp } from "react-icons/io5";
import { NavSidebar } from "./NavSidebar";

function pageForPathWithPlugins(pathname: string, pluginPages: PageDefinition[]): PageDefinition {
  const page = pageForPath(pathname, pluginPages);
  if (page.key !== "dashboard" || !pathname.startsWith("/ui/plugins/")) {
    return page;
  }
  const pluginId = pathname.slice("/ui/plugins/".length).split("/")[0];
  if (!pluginId) return page;
  return {
    key: `plugin:${pluginId}:${pathname}`,
    label: "Plugin",
    path: pathname,
    icon: "settings",
    section: "plugins",
    pluginId,
    pluginName: "Plugin",
    hideFromPrimary: true,
  };
}

export function AppLayout() {
  const { appMode, status, refreshKey, globalRefreshing, refreshGlobal } = useGlobalStatus();
  const { pluginPages, pluginStatusIssues } = usePluginNav();
  const { isOpen: logsOpen, selection: logSelection, closeLogs } = useLogModal();
  const location = useLocation();
  const navigate = useNavigate();

  const [navOpen, setNavOpen] = useState(false);
  const activePage = pageForPathWithPlugins(location.pathname, pluginPages);

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

  return (
    <AppModeProvider appMode={appMode}>
      <div className={`app-shell ${navOpen ? "mobile-nav-open" : ""}`}>
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
              <span className="command-icon" aria-hidden="true"><BrandLogo /></span>
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
            <Outlet />
          </main>
        </div>
        {navOpen ? <button className="mobile-nav-scrim" type="button" aria-label="Close navigation overlay" onClick={() => setNavOpen(false)} /> : null}
        <LogModal open={logsOpen} onClose={closeLogs} initialSelection={logSelection} />
      </div>
    </AppModeProvider>
  );
}