// AssessmentPage.tsx
import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../services/api";
import { marked } from "marked";
// Import your auth context or user context
// import { useAuth } from "../contexts/AuthContext";

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

export default function AssessmentPage() {
  const location = useLocation();
  const navigate = useNavigate();
  // const { user } = useAuth(); // Uncomment and use your auth context
  const [question, setQuestion] = useState<Question | null>(null);
  const [answer, setAnswer] = useState("");
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [loading, setLoading] = useState(false);
  const [hint, setHint] = useState("");
  const [attemptCount, setAttemptCount] = useState(0);

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
  }, [location.state, navigate]);

  const handleSubmit = async () => {
    if (!question || !answer.trim()) return;

    setLoading(true);
    try {
      const response = await api.post("/assessment/evaluate", {
        question: question.content, // instead of questionId
        answer,
        topic: question.topic,
        language: "Python", // or let user choose later
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

    try {
      const response = await api.post("/assessment/next-question", {
        currentTopic: question?.topic,
        performance: evaluation?.score,
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
      });
      setHint(response.data.hint);
      setAttemptCount((prev) => prev + 1);
    } catch (error) {
      console.error("Failed to get hint:", error);
    } finally {
      setLoading(false);
    }
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

              {/* Rest of your component remains the same */}
              <div className="mt-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Your Answer
                </label>
                <textarea
                  rows={8}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 font-mono"
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  disabled={!!evaluation}
                  placeholder="Write your Python code here..."
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
