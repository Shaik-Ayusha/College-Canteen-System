import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Menu from './pages/Menu.jsx';
import Orders from './pages/Orders.jsx';
import Admin from './pages/Admin.jsx';
import Kitchen from './pages/Kitchen.jsx';
import OrderReadyNotifications from './components/OrderReadyNotifications.jsx';

// Only logged-in users can see a page; the role decides which pages they may open
function Protected({ role, children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) {
    return <Navigate to={user.role === 'admin' ? '/admin' : '/menu'} replace />;
  }
  return <Layout>{children}</Layout>;
}

export default function App() {
  return (
    <>
      <OrderReadyNotifications />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/menu" element={<Protected role="student"><Menu /></Protected>} />
        <Route path="/orders" element={<Protected role="student"><Orders /></Protected>} />
        <Route path="/admin" element={<Protected role="admin"><Admin /></Protected>} />
        <Route path="/kitchen" element={<Protected role="admin"><Kitchen /></Protected>} />
        <Route path="*" element={<Navigate to="/menu" replace />} />
      </Routes>
    </>
  );
}
