// DashboardPage.tsx
import { useAuth } from "../../src/context/AuthContext";
import { Link, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import api from "../../src/services/api";

type RecentActivity = {
  concept: string;
  difficulty: string;
  result: string;
  timestamp: string;
};

type UserStats = {
  totalQuestionsAnswered: number;
  correctAnswers: number;
  accuracy: number;
  strongestConcept: string;
  weakestConcept: string;
  avgTimePerQuestion: string;
  knowledgeStates: Record<string, number>;
  recentActivities: RecentActivity[];
  currentStreaks: Record<string, number>;
  learningVelocity: Record<string, number>;
};

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [tempName, setTempName] = useState(user?.username || "");

  useEffect(() => {
    if (!user) {
      navigate("/login");
      return;
    }

    const fetchUserStats = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await api.get(`/users/${user.id}/stats`);
        console.log("Raw response:", response.data); // Debug log

        // Ensure all required properties exist with default values
        const safeStats: UserStats = {
          totalQuestionsAnswered: response.data?.totalQuestionsAnswered || 0,
          correctAnswers: response.data?.correctAnswers || 0,
          accuracy: response.data?.accuracy || 0,
          strongestConcept: response.data?.strongestConcept || "",
          weakestConcept: response.data?.weakestConcept || "",
          avgTimePerQuestion: response.data?.avgTimePerQuestion || "0m 0s",
          knowledgeStates: response.data?.knowledgeStates || {},
          recentActivities: Array.isArray(response.data?.recentActivities)
            ? response.data.recentActivities
            : [],
          currentStreaks: response.data?.currentStreaks || {},
          learningVelocity: response.data?.learningVelocity || {},
        };

        setStats(safeStats);
      } catch (err: any) {
        console.error("Failed to fetch stats:", err);
        setError(
          err.response?.data?.msg ||
            err.response?.data?.error ||
            "Failed to load dashboard data"
        );

        // Fallback to safe mock data
        const fallbackStats: UserStats = {
          totalQuestionsAnswered: 0,
          correctAnswers: 0,
          accuracy: 0,
          strongestConcept: "",
          weakestConcept: "",
          avgTimePerQuestion: "0m 0s",
          knowledgeStates: {},
          recentActivities: [],
          currentStreaks: {},
          learningVelocity: {},
        };

        setStats(fallbackStats);
      } finally {
        setLoading(false);
      }
    };

    fetchUserStats();
  }, [user, navigate]);

  const handleUpdateProfile = async () => {
    if (!user) return;
    try {
      await api.put(`/users/${user.id}`, { name: tempName });
      setEditMode(false);
    } catch (error) {
      console.error("Failed to update profile:", error);
    }
  };

  const startAssessment = async () => {
    if (!user) {
      alert("User not found. Please log in again.");
      return;
    }
    try {
      const sessionResponse = await api.post("/assessment/start", {
        userId: user.id,
      });

      navigate("/assessment", { state: { sessionData: sessionResponse.data } });
    } catch (error) {
      console.error("Failed to start assessment:", error);
      alert("Failed to start assessment. Please try again.");
    }
  };

  const getMasteryLevel = (mastery: number) => {
    if (mastery >= 0.8) return "Expert";
    if (mastery >= 0.6) return "Proficient";
    if (mastery >= 0.4) return "Intermediate";
    return "Beginner";
  };

  const getMasteryColor = (mastery: number) => {
    if (mastery >= 0.8) return "bg-green-500";
    if (mastery >= 0.6) return "bg-blue-500";
    if (mastery >= 0.4) return "bg-yellow-500";
    return "bg-red-500";
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty.toLowerCase()) {
      case "easy":
        return "bg-green-100 text-green-800";
      case "medium":
        return "bg-yellow-100 text-yellow-800";
      case "hard":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white shadow-xl rounded-2xl overflow-hidden">
          {/* Dashboard Header */}
          <div className="bg-gradient-to-r from-blue-700 to-indigo-800 p-6 text-white">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
              <div className="flex items-center space-x-4">
                <div className="h-16 w-16 rounded-full bg-white/20 flex items-center justify-center text-xl font-bold">
                  {user?.username ? user.username.charAt(0).toUpperCase() : "?"}
                </div>
                <div>
                  {editMode ? (
                    <input
                      type="text"
                      value={tempName}
                      onChange={(e) => setTempName(e.target.value)}
                      className="bg-white/20 border border-white/30 rounded px-3 py-1 text-white focus:outline-none focus:ring-2 focus:ring-white"
                      placeholder="Enter your name"
                    />
                  ) : (
                    <h1 className="text-2xl font-bold">
                      Welcome back, {user.username}!
                    </h1>
                  )}
                  <p className="text-white/90 mt-1">Your learning dashboard</p>
                </div>
              </div>
              <div className="mt-4 sm:mt-0 flex space-x-3">
                {editMode ? (
                  <>
                    <button
                      onClick={() => {
                        setEditMode(false);
                        setTempName(user.username);
                      }}
                      className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-md transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleUpdateProfile}
                      className="px-4 py-2 bg-white text-indigo-700 hover:bg-white/90 rounded-md transition-colors font-medium"
                    >
                      Save
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => setEditMode(true)}
                      className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-md transition-colors"
                    >
                      Edit Profile
                    </button>
                    <button
                      onClick={logout}
                      className="px-4 py-2 bg-red-500/90 hover:bg-red-600 text-white rounded-md transition-colors font-medium"
                    >
                      Logout
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* START ASSESSMENT SECTION */}
          <div className="p-6 bg-gradient-to-r from-indigo-600 to-purple-700 text-white rounded-xl mx-6 mt-6 shadow-lg">
            <div className="flex flex-col md:flex-row justify-between items-center">
              <div className="mb-6 md:mb-0">
                <h2 className="text-2xl font-bold">
                  {stats &&
                  stats.knowledgeStates &&
                  Object.keys(stats.knowledgeStates).length > 0
                    ? "Continue your learning journey"
                    : "Ready to test your skills?"}
                </h2>
                <p className="mt-2 max-w-lg">
                  {stats && stats.strongestConcept
                    ? `Your strongest area is ${
                        stats.strongestConcept
                      } (${getMasteryLevel(
                        stats.knowledgeStates[stats.strongestConcept] || 0
                      )}). Let's build on your progress!`
                    : "Take our comprehensive assessment to measure your current knowledge level and get personalized recommendations."}
                </p>
              </div>
              <button
                onClick={startAssessment}
                className="bg-white text-indigo-700 hover:bg-indigo-50 font-bold py-3 px-8 rounded-lg transition-colors duration-300 transform hover:scale-105 shadow-md"
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Loading...
                  </span>
                ) : stats && Object.keys(stats.knowledgeStates).length > 0 ? (
                  "Continue Assessment"
                ) : (
                  "Start Assessment"
                )}
              </button>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg
                    className="h-5 w-5 text-red-400"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">Error</h3>
                  <p className="text-sm text-red-600 mt-1">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Dashboard Content */}
          <div className="p-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* User Info Card */}
            <div className="lg:col-span-1 bg-gray-50 p-5 rounded-xl border border-gray-200">
              <h2 className="text-lg font-semibold mb-4 text-gray-800 flex items-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 mr-2"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                    clipRule="evenodd"
                  />
                </svg>
                Account Information
              </h2>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-500">Joined</p>
                  <p className="text-gray-800">
                    {new Date(user.createdAt).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Email</p>
                  <p className="text-gray-800">{user.email}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Member ID</p>
                  <p className="text-gray-800 font-mono text-sm">{user.id}</p>
                </div>
              </div>
            </div>

            {/* Stats Overview */}
            <div className="lg:col-span-3">
              {loading ? (
                <div className="bg-white border border-gray-200 rounded-xl p-8">
                  <div className="flex justify-center items-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
                  </div>
                  <p className="text-center text-gray-500 mt-4">
                    Loading your learning data...
                  </p>
                </div>
              ) : stats ? (
                <div className="space-y-6">
                  {/* Overall Stats */}
                  <div className="bg-white border border-gray-200 rounded-xl p-5">
                    <h2 className="text-lg font-semibold mb-4 text-gray-800 flex items-center">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5 mr-2"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
                      </svg>
                      Learning Statistics
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {/* Stat Cards */}
                      <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                        <div className="flex items-center">
                          <div className="bg-blue-100 p-2 rounded-lg">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-6 w-6 text-blue-600"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                              />
                            </svg>
                          </div>
                          <div className="ml-4">
                            <h3 className="text-sm font-medium text-blue-800">
                              Total Questions
                            </h3>
                            <p className="text-2xl font-bold text-blue-600">
                              {stats.totalQuestionsAnswered}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="bg-green-50 p-4 rounded-lg border border-green-100">
                        <div className="flex items-center">
                          <div className="bg-green-100 p-2 rounded-lg">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-6 w-6 text-green-600"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                              />
                            </svg>
                          </div>
                          <div className="ml-4">
                            <h3 className="text-sm font-medium text-green-800">
                              Correct Answers
                            </h3>
                            <p className="text-2xl font-bold text-green-600">
                              {stats.correctAnswers}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="bg-purple-50 p-4 rounded-lg border border-purple-100">
                        <div className="flex items-center">
                          <div className="bg-purple-100 p-2 rounded-lg">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-6 w-6 text-purple-600"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M13 10V3L4 14h7v7l9-11h-7z"
                              />
                            </svg>
                          </div>
                          <div className="ml-4">
                            <h3 className="text-sm font-medium text-purple-800">
                              Accuracy
                            </h3>
                            <p className="text-2xl font-bold text-purple-600">
                              {stats.accuracy.toFixed(1)}%
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Knowledge Map */}
                  {stats?.knowledgeStates &&
                    Object.keys(stats.knowledgeStates).length > 0 && (
                      <div className="bg-white border border-gray-200 rounded-xl p-5">
                        <h2 className="text-lg font-semibold mb-4 text-gray-800">
                          Knowledge Map
                        </h2>
                        <div className="space-y-4">
                          {Object.entries(stats.knowledgeStates || {})
                            .sort((a, b) => b[1] - a[1])
                            .slice(0, 5)
                            .map(([topic, mastery]) => (
                              <div key={topic} className="mb-3">
                                <div className="flex justify-between text-sm mb-1">
                                  <span className="font-medium">{topic}</span>
                                  <span className="text-gray-600">
                                    {getMasteryLevel(mastery)} (
                                    {(mastery * 100).toFixed(0)}%)
                                  </span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2.5">
                                  <div
                                    className={`h-2.5 rounded-full ${getMasteryColor(
                                      mastery
                                    )}`}
                                    style={{ width: `${mastery * 100}%` }}
                                  ></div>
                                </div>
                              </div>
                            ))}
                          <Link
                            to="/progress"
                            className="text-sm text-indigo-600 hover:text-indigo-800 mt-2 inline-block"
                          >
                            View full progress report →
                          </Link>
                        </div>
                      </div>
                    )}

                  {/* Recommended Next Steps */}
                  <div className="bg-white border border-gray-200 rounded-xl p-5">
                    <h2 className="text-lg font-semibold mb-4 text-gray-800">
                      Recommended Next Steps
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {stats.weakestConcept && (
                        <div className="bg-rose-50 p-4 rounded-lg border border-rose-100">
                          <h3 className="font-medium text-rose-800 mb-2">
                            Focus Area
                          </h3>
                          <p className="text-rose-600">
                            Practice more{" "}
                            <strong>{stats.weakestConcept}</strong> problems to
                            improve your weakest area
                          </p>
                        </div>
                      )}
                      {stats.strongestConcept && (
                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                          <h3 className="font-medium text-blue-800 mb-2">
                            Strengthen Expertise
                          </h3>
                          <p className="text-blue-600">
                            Try advanced{" "}
                            <strong>{stats.strongestConcept}</strong> problems
                            to master this concept
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-12 w-12 text-gray-400 mx-auto mb-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                    />
                  </svg>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    No Data Available
                  </h3>
                  <p className="text-gray-500">
                    Complete your first assessment to see your progress
                    statistics.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Recent Activity Section */}
          <div className="border-t border-gray-200 px-6 py-4 bg-gray-50">
            <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 mr-2"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                  clipRule="evenodd"
                />
              </svg>
              Recent Activity
            </h2>

            {stats?.recentActivities && stats.recentActivities.length > 0 ? (
              <div className="space-y-4">
                {stats.recentActivities.map((activity, index) => (
                  <div
                    key={index}
                    className="flex items-start pb-4 border-b border-gray-100 last:border-0"
                  >
                    <div
                      className={`flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center ${
                        activity.result === "Correct"
                          ? "bg-green-100 text-green-600"
                          : "bg-red-100 text-red-600"
                      }`}
                    >
                      {activity.result === "Correct" ? (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-6 w-6"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      ) : (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-6 w-6"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      )}
                    </div>
                    <div className="ml-4 flex-1">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-gray-900">
                          {activity.result} {activity.concept} problem
                        </p>
                        <span className="text-xs text-gray-500">
                          {new Date(activity.timestamp).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex mt-1">
                        <span
                          className={`text-xs px-2 py-1 rounded-full ${getDifficultyColor(
                            activity.difficulty
                          )}`}
                        >
                          {activity.difficulty}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">
                No recent activity yet. Start an assessment to begin tracking
                your progress!
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
