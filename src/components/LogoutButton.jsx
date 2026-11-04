import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

export default function LogoutButton({ className = 'btn btn-light btn-small', children = 'Logout' }) {
  const { logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <button type="button" className={className} onClick={handleLogout}>
      {children}
    </button>
  );
}
