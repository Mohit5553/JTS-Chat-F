import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import ClientPage from "./pages/ClientPage.jsx";
import AgentPage from "./pages/AgentPage.jsx";
import TicketStatusPage from "./pages/TicketStatusPage.jsx";
import ManagerPage from "./pages/ManagerPage.jsx";
import SalesPage from "./pages/SalesPage.jsx";
import SessionWarningModal from "./components/SessionWarningModal.jsx";

function destinationForRole(role) {
  if (["agent", "user"].includes(role)) return "/agent";
  if (role === "sales") return "/sales";
  if (role === "manager") return "/manager";
  if (role === "admin") return "/admin";
  return "/client";
}

function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="screen-center">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={destinationForRole(user.role)} replace />;
  }

  return children;
}


export default function App() {
  const { user, sessionWarning, extendSession, logout } = useAuth();

  return (
    <>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/ticket-status/:ticketId" element={<TicketStatusPage />} />
        <Route path="/admin" element={<ProtectedRoute allowedRoles={["admin"]}><ClientPage /></ProtectedRoute>} />
        <Route path="/manager" element={<ProtectedRoute allowedRoles={["manager"]}><ManagerPage /></ProtectedRoute>} />
        <Route path="/client" element={<ProtectedRoute allowedRoles={["client"]}><ClientPage /></ProtectedRoute>} />
        <Route path="/sales" element={<ProtectedRoute allowedRoles={["sales"]}><SalesPage /></ProtectedRoute>} />
        <Route path="/agent" element={<ProtectedRoute allowedRoles={["agent", "user"]}><AgentPage /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to={user ? destinationForRole(user.role) : "/login"} replace />} />
      </Routes>

      <SessionWarningModal
        open={sessionWarning}
        onExtend={extendSession}
        onLogout={logout}
      />
    </>
  );
}
