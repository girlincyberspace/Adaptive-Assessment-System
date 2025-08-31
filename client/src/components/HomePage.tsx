// HomePage.tsx
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function HomePage() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex flex-col items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <h1 className="text-4xl font-bold text-gray-800 mb-6">
          DSA Adaptive Assessment
        </h1>
        <p className="text-lg text-gray-600 mb-8">
          A personalized learning experience that adapts to your skill level in
          Data Structures and Algorithms.
        </p>

        {user ? (
          <div className="space-y-4">
            <Link
              to="/assessment"
              className="inline-block w-full md:w-auto px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-medium rounded-lg shadow-md hover:from-purple-700 hover:to-blue-700 transition-all"
            >
              Continue to Assessment
            </Link>
          </div>
        ) : (
          <div className="flex flex-col md:flex-row justify-center gap-4">
            <Link
              to="/login"
              className="px-6 py-3 bg-purple-600 text-white font-medium rounded-lg shadow-md hover:bg-purple-700 transition-colors"
            >
              Sign In
            </Link>
            <Link
              to="/signup"
              className="px-6 py-3 border border-purple-600 text-purple-600 font-medium rounded-lg hover:bg-purple-50 transition-colors"
            >
              Create Account
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
