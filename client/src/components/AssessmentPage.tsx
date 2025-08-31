// AssessmentPage.tsx
import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../services/api";

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

        if (!sessionData) {
          const response = await api.post("/assessment/start");
          sessionData = response.data;
        }

        // Get first question
        const questionResponse = await api.post("/assessment/question", {
          topic: sessionData.recommendedTopic,
        });
        setQuestion(questionResponse.data);
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
              <div
                className="prose max-w-none mb-6"
                dangerouslySetInnerHTML={{ __html: question.content }}
              />

              {/* Answer Area */}
              <div className="mt-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Your Answer
                </label>
                <textarea
                  rows={8}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  disabled={!!evaluation}
                />
              </div>

              {/* Action Buttons */}
              <div className="mt-6 flex flex-wrap gap-3">
                {!evaluation ? (
                  <>
                    <button
                      onClick={handleSubmit}
                      className="px-6 py-3 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      Submit Answer
                    </button>
                    <button
                      onClick={handleGetHint}
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
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Feedback
                  </h3>
                  <div
                    className={`p-4 rounded-md ${
                      evaluation.score >= 0.7
                        ? "bg-green-50 text-green-800"
                        : evaluation.score >= 0.4
                        ? "bg-yellow-50 text-yellow-800"
                        : "bg-red-50 text-red-800"
                    }`}
                  >
                    <div className="flex justify-between">
                      <strong>Score:</strong>
                      <span>{Math.round(evaluation.score * 100)}%</span>
                    </div>
                    <div
                      className="prose max-w-none mt-2"
                      dangerouslySetInnerHTML={{ __html: evaluation.feedback }}
                    />
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
