// AssessmentPage.tsx
import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../services/api";
import { marked } from "marked";

type Question = {
  id: string;
  content: string;
  topic: string;
  difficulty: string;
};

type Evaluation = {
  feedback: string;
  score: number;
  nextTopic?: string;
};

type ProgrammingLanguage = "python" | "java" | "javascript" | "go";

const LANGUAGE_OPTIONS = [
  { value: "python" as ProgrammingLanguage, label: "Python", icon: "🐍" },
  { value: "java" as ProgrammingLanguage, label: "Java", icon: "☕" },
  {
    value: "javascript" as ProgrammingLanguage,
    label: "JavaScript",
    icon: "🟨",
  },
  { value: "go" as ProgrammingLanguage, label: "Go", icon: "🐹" },
];

export default function AssessmentPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [question, setQuestion] = useState<Question | null>(null);
  const [answer, setAnswer] = useState("");
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [loading, setLoading] = useState(false);
  const [hint, setHint] = useState("");
  const [attemptCount, setAttemptCount] = useState(0);
  const [selectedLanguage, setSelectedLanguage] =
    useState<ProgrammingLanguage>("python");

  // Initialize assessment from location state or API
  useEffect(() => {
    const initializeAssessment = async () => {
      setLoading(true);
      try {
        let sessionData = location.state?.sessionData;
        console.log("Session data:", sessionData);

        if (!sessionData) {
          const userId = localStorage.getItem("userId");
          if (!userId) {
            console.error("No userId found, redirecting to login");
            navigate("/login");
            return;
          }

          const response = await api.post("/assessment/start", {
            userId: userId,
          });
          sessionData = response.data;
        }

        // Get first question
        const questionResponse = await api.post("/assessment/question", {
          topic: sessionData.recommendedTopic || "Programming",
          language: selectedLanguage, // Include language in question request
        });

        console.log("Question response:", questionResponse.data);
        const backendData = questionResponse.data;
        const transformedQuestion: Question = {
          id: backendData.id || "question-1",
          content:
            backendData.question ||
            backendData.content ||
            "No question content available",
          topic:
            backendData.topic || sessionData.recommendedTopic || "Programming",
          difficulty: backendData.difficulty || "Medium",
        };

        setQuestion(transformedQuestion);
      } catch (error) {
        console.error("Assessment initialization failed:", error);
        navigate("/dashboard");
      } finally {
        setLoading(false);
      }
    };

    initializeAssessment();
  }, [location.state, navigate, selectedLanguage]);

  // Reset answer when language changes
  useEffect(() => {
    if (evaluation) {
      setAnswer("");
      setEvaluation(null);
      setHint("");
      setAttemptCount(0);
    }
  }, [selectedLanguage]);

  const handleLanguageChange = (language: ProgrammingLanguage) => {
    setSelectedLanguage(language);
    setAnswer("");
    setHint("");
    setAttemptCount(0);
    // Don't clear evaluation here to allow language switching after submission
  };

  const handleSubmit = async () => {
    if (!question || !answer.trim()) return;

    setLoading(true);
    try {
      const response = await api.post("/assessment/evaluate", {
        question: question.content,
        answer,
        topic: question.topic,
        language: selectedLanguage,
      });

      setEvaluation(response.data);
      setAttemptCount(0);
    } catch (error) {
      console.error("Evaluation failed:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleNextQuestion = async () => {
    setLoading(true);
    setAnswer("");
    setEvaluation(null);
    setHint("");

    try {
      const response = await api.post("/assessment/next-question", {
        currentTopic: question?.topic,
        performance: evaluation?.score,
        language: selectedLanguage,
      });
      setQuestion(response.data);
    } catch (error) {
      console.error("Failed to get next question:", error);
      navigate("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  const handleGetHint = async () => {
    if (!question) return;

    setLoading(true);
    try {
      const response = await api.post("/assessment/hint", {
        topic: question.topic,
        attempt: attemptCount + 1,
        language: selectedLanguage,
      });
      setHint(response.data.hint);
      setAttemptCount((prev) => prev + 1);
    } catch (error) {
      console.error("Failed to get hint:", error);
    } finally {
      setLoading(false);
    }
  };

  const getLanguageIcon = (lang: ProgrammingLanguage) => {
    return (
      LANGUAGE_OPTIONS.find((option) => option.value === lang)?.icon || "💻"
    );
  };

  const getPlaceholderText = () => {
    const placeholders = {
      python: "Write your Python code here...",
      java: "Write your Java code here...",
      javascript: "Write your JavaScript code here...",
      go: "Write your Go code here...",
    };
    return placeholders[selectedLanguage];
  };

  if (loading && !question) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        {question && (
          <div className="bg-white shadow-xl rounded-2xl overflow-hidden">
            {/* Question Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-800 p-6 text-white">
              <div className="flex justify-between items-center">
                <div>
                  <span className="inline-block px-3 py-1 text-xs font-semibold bg-white/20 rounded-full mb-2">
                    {question.difficulty}
                  </span>
                  <h2 className="text-xl font-bold">{question.topic}</h2>
                </div>
                <button
                  onClick={() => navigate("/dashboard")}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-md transition-colors"
                >
                  Exit Assessment
                </button>
              </div>
            </div>

            {/* Question Content */}
            <div className="p-6">
              {/* Convert markdown-style content to readable format */}
              <div
                className="prose max-w-none mb-6"
                dangerouslySetInnerHTML={{
                  __html: marked(question.content || ""),
                }}
              />

              {/* Language Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Select Programming Language
                </label>
                <div className="flex flex-wrap gap-3">
                  {LANGUAGE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => handleLanguageChange(option.value)}
                      disabled={loading}
                      className={`flex items-center space-x-2 px-4 py-2 rounded-lg border-2 transition-all duration-200 ${
                        selectedLanguage === option.value
                          ? "border-blue-500 bg-blue-50 text-blue-700 shadow-md"
                          : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                      } disabled:opacity-50`}
                    >
                      <span className="text-lg">{option.icon}</span>
                      <span className="font-medium">{option.label}</span>
                      {selectedLanguage === option.value && (
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Answer Input */}
              <div className="mt-6">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Your Answer
                  </label>
                  <span className="text-sm text-gray-500 flex items-center">
                    {getLanguageIcon(selectedLanguage)}{" "}
                    {selectedLanguage.charAt(0).toUpperCase() +
                      selectedLanguage.slice(1)}
                  </span>
                </div>
                <textarea
                  rows={8}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  disabled={!!evaluation}
                  placeholder={getPlaceholderText()}
                />
              </div>

              {/* Action Buttons */}
              <div className="mt-6 flex flex-wrap gap-3">
                {!evaluation ? (
                  <>
                    <button
                      onClick={handleSubmit}
                      disabled={!answer.trim() || loading}
                      className="px-6 py-3 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                      {loading ? "Submitting..." : "Submit Answer"}
                    </button>
                    <button
                      onClick={handleGetHint}
                      disabled={loading}
                      className="px-6 py-3 bg-purple-100 text-purple-700 font-medium rounded-md hover:bg-purple-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
                    >
                      Get Hint
                    </button>
                  </>
                ) : (
                  <button
                    onClick={handleNextQuestion}
                    className="px-6 py-3 bg-green-600 text-white font-medium rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                  >
                    Next Question
                  </button>
                )}
              </div>

              {/* Hint Display */}
              {hint && (
                <div className="mt-6 p-4 bg-yellow-50 border-l-4 border-yellow-400">
                  <h3 className="text-sm font-medium text-yellow-800">Hint</h3>
                  <div className="mt-2 text-sm text-yellow-700">
                    <p>{hint}</p>
                  </div>
                </div>
              )}

              {/* Evaluation Feedback */}
              {evaluation && (
                <div className="mt-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">
                    Assessment Results
                  </h3>
                  <div
                    className={`rounded-lg border-l-4 overflow-hidden ${
                      evaluation.score >= 0.7
                        ? "bg-green-50 border-green-400"
                        : evaluation.score >= 0.4
                        ? "bg-yellow-50 border-yellow-400"
                        : "bg-red-50 border-red-400"
                    }`}
                  >
                    {/* Score Header */}
                    <div
                      className={`px-6 py-4 ${
                        evaluation.score >= 0.7
                          ? "bg-green-100"
                          : evaluation.score >= 0.4
                          ? "bg-yellow-100"
                          : "bg-red-100"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <div
                            className={`w-3 h-3 rounded-full ${
                              evaluation.score >= 0.7
                                ? "bg-green-500"
                                : evaluation.score >= 0.4
                                ? "bg-yellow-500"
                                : "bg-red-500"
                            }`}
                          ></div>
                          <span
                            className={`text-sm font-medium ${
                              evaluation.score >= 0.7
                                ? "text-green-800"
                                : evaluation.score >= 0.4
                                ? "text-yellow-800"
                                : "text-red-800"
                            }`}
                          >
                            {evaluation.score >= 0.7
                              ? "Excellent"
                              : evaluation.score >= 0.4
                              ? "Good Effort"
                              : "Needs Improvement"}
                          </span>
                        </div>
                        <div
                          className={`text-xl font-bold ${
                            evaluation.score >= 0.7
                              ? "text-green-700"
                              : evaluation.score >= 0.4
                              ? "text-yellow-700"
                              : "text-red-700"
                          }`}
                        >
                          {Math.round(evaluation.score * 100)}%
                        </div>
                      </div>
                    </div>

                    {/* Formatted Feedback Content */}
                    <div className="px-6 py-4">
                      <div
                        className={`prose prose-sm max-w-none ${
                          evaluation.score >= 0.7
                            ? "prose-green"
                            : evaluation.score >= 0.4
                            ? "prose-yellow"
                            : "prose-red"
                        }`}
                        style={{
                          color:
                            evaluation.score >= 0.7
                              ? "#065f46"
                              : evaluation.score >= 0.4
                              ? "#92400e"
                              : "#991b1b",
                        }}
                        dangerouslySetInnerHTML={{
                          __html: marked(evaluation.feedback || "", {
                            breaks: true,
                            gfm: true,
                          }),
                        }}
                      />
                    </div>
                  </div>

                  {/* Progress Indicator */}
                  <div className="mt-4">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>Progress</span>
                      <span>
                        {Math.round(evaluation.score * 100)}% Complete
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all duration-500 ${
                          evaluation.score >= 0.7
                            ? "bg-green-500"
                            : evaluation.score >= 0.4
                            ? "bg-yellow-500"
                            : "bg-red-500"
                        }`}
                        style={{ width: `${evaluation.score * 100}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
