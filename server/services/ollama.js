// services/ollama.js
const axios = require("axios");
const Session = require("../models/Session");

const API_URL = "http://localhost:8000/assessment";
const TIMEOUT = 5000; // 5 seconds timeout

// Create axios instance with timeout
const apiClient = axios.create({
  baseURL: API_URL,
  timeout: TIMEOUT,
  headers: {
    "Content-Type": "application/json",
  },
});

module.exports = {
  async startSession(userId) {
    try {
      console.log(`Starting session for user ${userId}`);

      // Load previous session from MongoDB if exists
      const existing = await Session.findOne({ user: userId });
      if (existing) {
        console.log("Found existing session, trying to restore...");
        try {
          await apiClient.post("/save-session", existing.data);
          return existing.data;
        } catch (apiError) {
          console.warn(
            "Failed to restore session to Python service, using MongoDB data:",
            apiError.message
          );
          return existing.data;
        }
      }

      // Try to create new session with Python service
      try {
        const response = await apiClient.post("/start", { userId });
        return response.data;
      } catch (apiError) {
        console.warn(
          "Python service unavailable, creating fallback session:",
          apiError.message
        );

        // Fallback: Create a basic session structure
        const fallbackSession = {
          sessionId: `session_${Date.now()}`,
          userId: userId,
          knowledgeStates: {
            JavaScript: 0.3,
            Python: 0.5,
            React: 0.7,
            "Node.js": 0.4,
            Algorithms: 0.2,
            "Data Structures": 0.6,
          },
          currentTopic: "JavaScript",
          questionCount: 0,
          topics: [
            "JavaScript",
            "Python",
            "React",
            "Node.js",
            "Algorithms",
            "Data Structures",
          ],
          timestamp: new Date().toISOString(),
          questionHistory: [],
          currentStreaks: {},
          learningVelocity: {},
        };

        return fallbackSession;
      }
    } catch (error) {
      console.error("Error in startSession:", error);
      throw new Error(`Failed to start session: ${error.message}`);
    }
  },

  async persistSession(userId) {
    try {
      console.log(`Persisting session for user ${userId}`);

      // Try to get session from Python service
      let sessionData;
      try {
        const res = await apiClient.get("/session");
        sessionData = res.data;
      } catch (apiError) {
        console.warn(
          "Could not fetch from Python service, using existing MongoDB data:",
          apiError.message
        );

        // Fallback: Get from MongoDB
        const existing = await Session.findOne({ user: userId });
        if (existing) {
          return existing.data;
        }

        throw new Error("No session data available");
      }

      // Save to MongoDB
      const updatedSession = await Session.findOneAndUpdate(
        { user: userId },
        {
          data: sessionData,
          updatedAt: new Date(),
        },
        {
          upsert: true,
          new: true,
        }
      );

      return sessionData;
    } catch (error) {
      console.error("Error in persistSession:", error);
      throw new Error(`Failed to persist session: ${error.message}`);
    }
  },

  async generateQuestion(topic, mastery = 0.5) {
    try {
      console.log(
        `Generating question for topic: ${topic}, mastery: ${mastery}`
      );

      try {
        const response = await apiClient.post("/generate-question", {
          topic,
          mastery,
        });
        return response.data;
      } catch (apiError) {
        console.warn(
          "Python service unavailable for question generation, using fallback"
        );

        // Fallback question generation
        return this.generateFallbackQuestion(topic, mastery);
      }
    } catch (error) {
      console.error("Error in generateQuestion:", error);
      throw new Error(`Failed to generate question: ${error.message}`);
    }
  },

  async evaluateAnswer(question, answer, topic, language = "en") {
    try {
      console.log(`Evaluating answer for topic: ${topic}`);

      try {
        const response = await apiClient.post("/evaluate", {
          question,
          answer,
          topic,
          language,
        });
        return response.data;
      } catch (apiError) {
        console.warn(
          "Python service unavailable for evaluation, using fallback"
        );

        // Fallback evaluation
        return this.generateFallbackEvaluation(question, answer, topic);
      }
    } catch (error) {
      console.error("Error in evaluateAnswer:", error);
      throw new Error(`Failed to evaluate answer: ${error.message}`);
    }
  },

  async getAdaptiveHint(topic, mastery, context, attempt = 0) {
    try {
      try {
        const response = await apiClient.post("/hint", {
          topic,
          mastery,
          context,
          attempt,
        });
        return response.data.hint;
      } catch (apiError) {
        console.warn("Python service unavailable for hints, using fallback");

        // Fallback hints
        const fallbackHints = [
          `Think about the core ${topic} concepts first.`,
          `Consider how this ${topic} problem relates to previous examples.`,
          `Break this ${topic} challenge into smaller, manageable steps.`,
          `Review the fundamental ${topic} principles that apply here.`,
        ];

        return fallbackHints[attempt % fallbackHints.length];
      }
    } catch (error) {
      console.error("Error in getAdaptiveHint:", error);
      throw new Error(`Failed to get hint: ${error.message}`);
    }
  },

  async getLearningAnalytics(userId) {
    try {
      console.log(`Getting analytics for user ${userId}`);

      try {
        const response = await apiClient.get(`/analytics/${userId}`);
        return response.data;
      } catch (apiError) {
        console.warn(
          "Python service unavailable for analytics, using fallback"
        );

        // Fallback analytics
        return {
          totalQuestions: 0,
          correctAnswers: 0,
          accuracy: 0,
          strengths: [],
          weaknesses: [],
          recommendedTopics: ["JavaScript", "Python"],
          learningVelocity: {},
        };
      }
    } catch (error) {
      console.error("Error in getLearningAnalytics:", error);
      throw new Error(`Failed to get analytics: ${error.message}`);
    }
  },

  async getNextRecommendedTopic(currentTopic, performance) {
    try {
      try {
        const response = await apiClient.post("/next-topic", {
          currentTopic,
          performance,
        });
        return response.data.topic;
      } catch (apiError) {
        console.warn(
          "Python service unavailable for topic recommendation, using fallback"
        );

        // Fallback topic recommendation
        const topics = [
          "JavaScript",
          "Python",
          "React",
          "Node.js",
          "Algorithms",
          "Data Structures",
        ];
        const currentIndex = topics.indexOf(currentTopic);
        const nextIndex = (currentIndex + 1) % topics.length;
        return topics[nextIndex];
      }
    } catch (error) {
      console.error("Error in getNextRecommendedTopic:", error);
      throw new Error(`Failed to get next topic: ${error.message}`);
    }
  },

  // Fallback methods for when Python service is unavailable
  generateFallbackQuestion(topic, mastery) {
    const questionBank = {
      JavaScript: {
        easy: [
          "What is a variable in JavaScript?",
          "How do you declare a function in JavaScript?",
        ],
        medium: [
          "Explain closures in JavaScript",
          "What is the difference between let and var?",
        ],
        hard: [
          "Explain the JavaScript event loop",
          "What is prototypal inheritance?",
        ],
      },
      Python: {
        easy: [
          "What is a list in Python?",
          "How do you create a function in Python?",
        ],
        medium: [
          "Explain list comprehensions in Python",
          "What is the difference between a list and tuple?",
        ],
        hard: [
          "What is the Global Interpreter Lock (GIL)?",
          "Explain decorators in Python",
        ],
      },
      React: {
        easy: ["What is JSX in React?", "How do you create a React component?"],
        medium: [
          "Explain the difference between state and props",
          "What are React hooks?",
        ],
        hard: [
          "Explain the virtual DOM concept",
          "What is the React Context API?",
        ],
      },
    };

    const difficulty =
      mastery < 0.3 ? "easy" : mastery < 0.7 ? "medium" : "hard";
    const questions =
      questionBank[topic]?.[difficulty] || questionBank["JavaScript"]["easy"];
    const randomQuestion =
      questions[Math.floor(Math.random() * questions.length)];

    return {
      id: `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      content: randomQuestion,
      topic: topic,
      difficulty: difficulty.charAt(0).toUpperCase() + difficulty.slice(1),
      options: [
        "Option A: First possible answer",
        "Option B: Second possible answer",
        "Option C: Third possible answer",
        "Option D: Fourth possible answer",
      ],
    };
  },

  generateFallbackEvaluation(question, answer, topic) {
    // Simple fallback evaluation logic
    const score = Math.random() * 0.4 + 0.3; // Random score between 0.3 and 0.7
    const isCorrect = score >= 0.6;

    return {
      score: score,
      isCorrect: isCorrect,
      feedback: isCorrect
        ? "Good job! Your understanding is developing well."
        : "Keep practicing! Consider reviewing the key concepts.",
      explanation:
        "This is a fallback evaluation. The full AI assessment service would provide more detailed feedback.",
      topic: topic,
      difficulty: "Medium",
      timestamp: new Date().toISOString(),
    };
  },
};
