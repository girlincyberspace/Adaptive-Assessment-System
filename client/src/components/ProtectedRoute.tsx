// components/ProtectedRoute.tsx
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

interface ProtectedRouteProps {
  children: React.ReactElement; // 👈 allow passing in a child component
}

function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user } = useAuth();

  if (!user) {
    // Redirect to login if no user
    return <Navigate to="/login" replace />;
  }

  return children;
}

export default ProtectedRoute;
