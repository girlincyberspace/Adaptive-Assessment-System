// App.tsx
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import LoginPage from "./components/LoginPage";
import SignUpPage from "./components/SignUpPage";
import ProtectedRoute from "./components/ProtectedRoute";
import AssessmentPage from "./components/AssessmentPage";
import HomePage from "./components/HomePage";
import DashboardPage from "./components/DashboardPage";

// Loading component to show while auth is initializing
function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
    </div>
  );
}

// Main app content that waits for auth initialization
function AppContent() {
  const { authInitialized } = useAuth();

  // Show loading screen until auth state is determined
  if (!authInitialized) {
    return <LoadingScreen />;
  }

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignUpPage />} />
      <Route path="/" element={<HomePage />} />
      <Route path="/assessment" element={<AssessmentPage />} />

      {/* Protected routes */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />

      {/* Example for adding more protected routes later */}
      {/*
      <Route 
        path="/profile" 
        element={
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        } 
      />
      */}
    </Routes>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </Router>
  );
}

export default App;
