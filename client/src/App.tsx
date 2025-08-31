// App.tsx
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import LoginPage from "./components/LoginPage";
import SignUpPage from "./components/SignUpPage";
import ProtectedRoute from "./components/ProtectedRoute";
import AssessmentPage from "./components/AssessmentPage";
import HomePage from "./components/HomePage";
import DashoardPage from "./components/DashboardPage";

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignUpPage />} />
          <Route path="/" element={<HomePage />} />
          <Route path="/assessment" element={<AssessmentPage />} />

          {/* Protected routes */}
          <Route element={<ProtectedRoute />}></Route>
          <Route path="/dashboard" element={<DashoardPage />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
