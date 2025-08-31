// AuthContext.tsx
import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";
import type { User, AuthContextType } from "../../types/auth-types";
import api from "../services/api"; // ✅ use your axios instance

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ✅ Login
  const login = async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.post("/auth/login", { email, password });

      localStorage.setItem("token", res.data.token);
      setUser(res.data.user);
    } catch (err: any) {
      setError(err.response?.data?.msg || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  // ✅ Signup
  const signup = async (name: string, email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.post("/auth/signup", {
        username: name, // 👈 backend expects username
        email,
        password,
      });

      localStorage.setItem("token", res.data.token);
      setUser(res.data.user);
    } catch (err: any) {
      setError(err.response?.data?.msg || "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  // ✅ Logout
  const logout = () => {
    localStorage.removeItem("token");
    setUser(null);
  };

  // ✅ Update Profile
  const updateProfile = async (name: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.put("/auth/profile", { name });

      setUser(res.data.user);
    } catch (err: any) {
      setError(err.response?.data?.msg || "Profile update failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, login, signup, logout, updateProfile, loading, error }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
