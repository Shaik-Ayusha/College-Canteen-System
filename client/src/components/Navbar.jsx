import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const links = user.role === 'admin'
    ? [['/admin', 'Admin dashboard'], ['/kitchen', 'Kitchen display']]
    : [['/menu', 'Menu'], ['/orders', 'My orders']];

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <header className="topbar">
      <NavLink className="topbar-brand" to={user.role === 'admin' ? '/admin' : '/menu'}>
        <span className="topbar-brand-mark" aria-hidden="true">
          <svg viewBox="0 0 32 32" fill="none">
            <path d="M5 17h22c-.7 6-4.4 9-11 9s-10.3-3-11-9Z" />
            <path d="M9 12c0-1.8 1.8-1.8 1.8-3.6M16 12c0-1.8 1.8-1.8 1.8-3.6M23 12c0-1.8 1.8-1.8 1.8-3.6" />
          </svg>
        </span>
        <span>
          <strong>Campus Table</strong>
          <small>THE COLLEGE CANTEEN</small>
        </span>
      </NavLink>
      <nav aria-label="Main navigation">
        {links.map(([to, label]) => (
          <NavLink key={to} to={to}>{label}</NavLink>
        ))}
        <span className="user-name"><span className="user-name-dot" />{user.name}</span>
        <button className="logout-button" onClick={handleLogout}>
          Log out <span aria-hidden="true">↗</span>
        </button>
      </nav>
    </header>
  );
}
