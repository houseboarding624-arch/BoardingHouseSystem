import { Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import Home from './pages/Home.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import BoarderDashboard from './pages/BoarderDashboard.jsx';
import QrGenerator from './pages/QrGenerator.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';
import OwnerDashboard from './pages/OwnerDashboard.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />

      <Route
        path="/boarder"
        element={
          <ProtectedRoute roles={['Boarder']}>
            <BoarderDashboard />
          </ProtectedRoute>
        }
      />
      {/* Scanning is public now: it lives on the home page. */}
      <Route path="/boarder/scan" element={<Navigate to="/#scan" replace />} />

      {/* Dashboards are swapped: Admin gets the full management dashboard (OwnerDashboard.jsx),
          Owner gets the simple overview (AdminDashboard.jsx). */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute roles={['Admin']}>
            <OwnerDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/owner"
        element={
          <ProtectedRoute roles={['Owner']}>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/qr"
        element={
          <ProtectedRoute roles={['Admin', 'Owner']}>
            <QrGenerator />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
