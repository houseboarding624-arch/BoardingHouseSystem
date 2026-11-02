import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, HOME_BY_ROLE } from '../auth.jsx';

export default function ProtectedRoute({ roles, children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <main className="container narrow">
        <p className="muted">Loading…</p>
      </main>
    );
  }

  if (!user) {
    const next = encodeURIComponent(location.pathname);
    return <Navigate to={`/login?error=${encodeURIComponent('Please login first.')}&next=${next}`} replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to={HOME_BY_ROLE[user.role] || '/'} replace />;
  }

  return children;
}
