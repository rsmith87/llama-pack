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

export function NavSidebar({ activePage, onClose }: NavSidebarProps) {
  const { appMode, controllerUrl, controllerReachable, agentNodes } = useGlobalStatus();
  const { pluginPages } = usePluginNav();
  const { openLogs } = useLogModal();
  const visibleSections = pagesBySectionForMode(appMode, pluginPages);

  return (
    <aside className="app-sidebar" aria-label="Primary">
      <div className="brand-lockup">
        <div className="brand-mark" aria-hidden="true"><BrandLogo /></div>
        <div>
          <h1>Neuraxis</h1>
          <p>{appMode === "agent" ? "Agent runtime" : appMode === "controller" ? "Private AI gateway" : "Gateway console"}</p>
        </div>
      </div>
      <nav className="app-nav" aria-label="Primary navigation">
        {visibleSections.map((section) => (
          <div className="nav-section" key={section.key}>
            <div className="nav-section-label">{section.label}</div>
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
        ))}
      </nav>
      <div className="sidebar-footer absolute bottom-0">
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