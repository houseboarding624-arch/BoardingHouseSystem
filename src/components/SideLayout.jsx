import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import LogoutButton from './LogoutButton.jsx';

/**
 * Sidebar + content layout (two columns): buttons on the left, the selected view on the right.
 * groups: [{ label?, items: [{ icon, label, view?, to?, badge? }] }]
 *  - `view` switches the view through the URL hash (basePath#view)
 *  - `to` links to another page instead
 */
export default function SideLayout({ basePath, groups, current, userName, children }) {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [current]);

  const initial = (userName || '?').trim().charAt(0).toUpperCase();

  return (
    <div className="owner-layout">
      <aside className="owner-sidebar">
        <Link className="owner-logo" to={basePath}>
          <span className="owner-logo-mark">⌂</span>
          <span>Boarding House</span>
        </Link>

        {groups.map((g, i) => (
          <div key={g.label || i}>
            {g.label && <div className="owner-nav-group">{g.label}</div>}
            <nav className="owner-nav">
              {g.items.map((item) => (
                <Link
                  key={item.view || item.to}
                  className={item.view && current === item.view ? 'active' : ''}
                  to={item.to || `${basePath}#${item.view}`}
                >
                  <span className="nav-icon">{item.icon}</span>
                  {item.label}
                  {item.badge > 0 && <span className="nav-badge">{item.badge}</span>}
                </Link>
              ))}
            </nav>
          </div>
        ))}
      </aside>

      <main className="owner-main">
        <header className="owner-topbar">
          <div className="owner-user">
            <span>Welcome, {userName}</span>
            <span className="owner-avatar">{initial}</span>
            <LogoutButton className="owner-logout">Logout</LogoutButton>
          </div>
        </header>

        <div className="owner-content">{children}</div>
      </main>
    </div>
  );
}
