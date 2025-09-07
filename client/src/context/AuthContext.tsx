// AuthContext.tsx
import { createContext, useContext, useState, useEffect } from "react";
import type { ReactNode } from "react";
import type { User, AuthContextType } from "../../types/auth-types";
import api from "../services/api";

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authInitialized, setAuthInitialized] = useState(false);

  // Initialize auth state on app load
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const token = localStorage.getItem("token");
        const savedUser = localStorage.getItem("user");

        if (token && savedUser) {
          // Set the authorization header
          api.defaults.headers.common["Authorization"] = `Bearer ${token}`;

          // Verify token is still valid by making a test request
          try {
            await api.get("/auth/verify"); // Assumes you have a verify endpoint

            // If verification succeeds, restore user state
            setUser(JSON.parse(savedUser));
          } catch (verifyError) {
            // Token is invalid, clear stored data
            console.warn("Stored token is invalid, clearing auth data");
            localStorage.removeItem("token");
            localStorage.removeItem("user");
            delete api.defaults.headers.common["Authorization"];
          }
        }
      } catch (error) {
        console.error("Error initializing auth:", error);
        // Clear potentially corrupted data
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        delete api.defaults.headers.common["Authorization"];
      } finally {
        setAuthInitialized(true);
      }
    };

    initializeAuth();
  }, []);

  // Set up axios interceptor to handle token expiration
  useEffect(() => {
    const responseInterceptor = api.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Token expired or invalid, log user out
          logout();
        }
        return Promise.reject(error);
      }
    );

    // Cleanup interceptor on unmount
    return () => {
      api.interceptors.response.eject(responseInterceptor);
    };
  }, []);

  const login = async (email: string, password: string) => {
    setLoading(true);
    setError(null);

    try {
      const res = await api.post("/auth/login", { email, password });
      const { token, user: userData } = res.data;

      // Store auth data
      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(userData));

      // Update state
      setUser(userData);
      api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    } catch (err: any) {
      setError(err.response?.data?.msg || "Login failed");
      throw err; // Re-throw so calling component can handle if needed
    } finally {
      setLoading(false);
    }
  };

  const signup = async (name: string, email: string, password: string) => {
    setLoading(true);
    setError(null);

    try {
      const res = await api.post("/auth/signup", {
        username: name,
        email,
        password,
      });
      const { token, user: userData } = res.data;

      // Store auth data
      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(userData));

      // Update state
      setUser(userData);
      api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    } catch (err: any) {
      setError(err.response?.data?.msg || "Signup failed");
      throw err; // Re-throw so calling component can handle if needed
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    // Clear all auth data
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    setError(null);
    delete api.defaults.headers.common["Authorization"];
  };

  const updateProfile = async (name: string) => {
    setLoading(true);
    setError(null);

    try {
      const res = await api.put("/auth/profile", { name });
      const updatedUser = res.data.user;

      // Update both state and localStorage
      setUser(updatedUser);
      localStorage.setItem("user", JSON.stringify(updatedUser));
    } catch (err: any) {
      setError(err.response?.data?.msg || "Profile update failed");
      throw err; // Re-throw so calling component can handle if needed
    } finally {
      setLoading(false);
    }
  };

  // Optional: Method to refresh user data
  const refreshUser = async () => {
    if (!user) return;

    try {
      const res = await api.get("/auth/me"); // Assumes you have a "get current user" endpoint
      const updatedUser = res.data.user;

      setUser(updatedUser);
      localStorage.setItem("user", JSON.stringify(updatedUser));
    } catch (err) {
      console.error("Failed to refresh user data:", err);
      // Could optionally logout on failure
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        signup,
        logout,
        updateProfile,
        refreshUser, // Add this if you want to expose it
        loading,
        error,
        authInitialized,
      }}
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
