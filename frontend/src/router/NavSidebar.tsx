import { useState, useEffect } from "react";
import { NavLink } from "react-router-dom";
import { pagesBySectionForMode, type PageDefinition } from "../routes/pages";
import { useGlobalStatus } from "../features/globalStatus/globalStatusContext";
import { usePluginNav } from "../features/plugins/pluginNavContext";
import { useLogModal } from "../features/logs/logModalContext";
import { BrandLogo } from "../components/BrandLogo";
import { MenuIcon } from "../components/MenuIcon";

type NavSidebarProps = {
  activePage: PageDefinition;
  onClose?: () => void;
};

function loadCollapsed(mode: string | undefined): Set<string> {
  try {
    const raw = localStorage.getItem(`nav-collapsed-${mode || "default"}`);
    if (raw) return new Set(JSON.parse(raw) as string[]);
  } catch { /* ignore */ }
  return new Set();
}

export function NavSidebar({ activePage, onClose }: NavSidebarProps) {
  const { appMode, controllerUrl, controllerReachable, agentNodes } = useGlobalStatus();
  const { pluginPages } = usePluginNav();
  const { openLogs } = useLogModal();
  const visibleSections = pagesBySectionForMode(appMode, pluginPages);

  const [collapsed, setCollapsed] = useState<Set<string>>(() => loadCollapsed(appMode));

  useEffect(() => {
    setCollapsed(loadCollapsed(appMode));
  }, [appMode]);

  function toggleSection(key: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      try {
        localStorage.setItem(`nav-collapsed-${appMode || "default"}`, JSON.stringify([...next]));
      } catch { /* ignore */ }
      return next;
    });
  }

  return (
    <aside className="app-sidebar" aria-label="Primary">
      <div className="brand-lockup">
        <div className="brand-mark" aria-hidden="true"><BrandLogo /></div>
        <div>
          <h1>Llama Pack</h1>
          <p>{appMode === "agent" ? "Agent runtime" : appMode === "controller" ? "Private AI gateway" : "Gateway console"}</p>
        </div>
      </div>
      <nav className="app-nav" aria-label="Primary navigation">
        {visibleSections.map((section) => {
          const isCollapsed = collapsed.has(section.key);
          return (
            <div className={`nav-section ${isCollapsed ? "collapsed" : ""}`} key={section.key}>
              <button
                className="nav-section-toggle"
                type="button"
                onClick={() => toggleSection(section.key)}
                aria-expanded={!isCollapsed}
              >
                <span className="nav-section-label">{section.label}</span>
                <span className={`collapse-chevron ${isCollapsed ? "collapsed" : ""}`} aria-hidden="true" />
              </button>
              {section.pages.map((item) => (
                <NavLink
                  key={item.key}
                  to={item.path}
                  className={({ isActive }) =>
                    `nav-button cursor-pointer ${isActive ? "active" : ""}`
                  }
                  onClick={onClose}
                  end={item.path === "/"}
                >
                  <MenuIcon icon={item.icon} />
                  <span>{item.navLabel || item.label}</span>
                </NavLink>
              ))}
              {section.key === "operations" ? (
                <button
                  className="nav-button modal-nav-button"
                  type="button"
                  onClick={() => {
                    openLogs();
                    onClose?.();
                  }}
                >
                  <MenuIcon icon="logs" />
                  <span>Logs</span>
                </button>
              ) : null}
            </div>
          );
        })}
      </nav>
      <div className="sidebar-footer">
        {appMode === "agent" && controllerUrl ? (
          <div className="sidebar-peers">
            <div className="sidebar-peers-label">Controller</div>
            <a
              className="sidebar-peer-link"
              href={controllerUrl}
              target="_blank"
              rel="noopener noreferrer"
              title={controllerUrl}
            >
              <span
                className={`peer-status-dot ${controllerReachable === true ? "online" : controllerReachable === false ? "offline" : ""}`}
                aria-hidden="true"
              />
              <MenuIcon icon="controller" />
              <span className="sidebar-peer-name">{controllerUrl}</span>
            </a>
          </div>
        ) : null}
        {appMode === "controller" && agentNodes.length > 0 ? (
          <div className="sidebar-peers">
            <div className="sidebar-peers-label">Agent Nodes</div>
            {agentNodes.map((node) => (
              <a
                key={node.name}
                className="sidebar-peer-link"
                href={node.url}
                target="_blank"
                rel="noopener noreferrer"
                title={node.url}
              >
                <span
                  className={`peer-status-dot ${node.reachable ? "online" : "offline"}`}
                  aria-hidden="true"
                />
                <MenuIcon icon="nodes" />
                <span className="sidebar-peer-name">{node.name}</span>
              </a>
            ))}
          </div>
        ) : null}
      </div>
    </aside>
  );
}