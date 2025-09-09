const express = require("express");
const router = express.Router();
const ollamaService = require("../services/ollama");
const sessionService = require("../services/session");
const auth = require("../middleware/auth");
const Session = require("../models/Session");

router.use(auth);

// Health check for Ollama
router.get("/health", async (req, res) => {
  try {
    const health = await ollamaService.checkOllamaHealth();
    res.json(health);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start a new assessment session
router.post("/start", async (req, res) => {
  try {
    const { userId } = req.body;

    console.log("Starting assessment for userId:", userId);

    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    // Create new assessment session
    const session = new Session({
      user: userId,
      sessionType: "assessment",
      knowledgeStates: [],
      questionHistory: [],
      currentStreaks: new Map(),
      learningVelocity: new Map(),
      isCompleted: false,
    });

    await session.save();

    // Convert session data to frontend format
    const knowledgeState = {};
    session.knowledgeStates.forEach((ks) => {
      knowledgeState[ks.topic] = ks.mastery;
    });

    // Group question history by topic
    const sessionHistory = {};
    session.questionHistory.forEach((q) => {
      if (!sessionHistory[q.topic]) {
        sessionHistory[q.topic] = [];
      }
      sessionHistory[q.topic].push(q);
    });

    const responseData = {
      sessionId: session._id,
      userId: userId,
      knowledgeState,
      sessionHistory,
      currentTopic: session.currentTopic || null,
      questionCount: session.questionHistory?.length || 0,
    };

    console.log("Assessment session response:", responseData);
    res.json(responseData);
  } catch (error) {
    console.error("Error in /assessment/start:", error);
    res.status(500).json({
      msg: "Server error",
      error: error.message,
      stack: error.stack,
    });
  }
});

// **NEW ENDPOINT** - End assessment session
router.post("/end", async (req, res) => {
  try {
    const { sessionId, userId } = req.body;

    console.log("Ending assessment session:", { sessionId, userId });

    if (!sessionId && !userId) {
      return res.status(400).json({
        error: "Either sessionId or userId is required",
      });
    }

    // Find session by ID or userId (fallback)
    let session;
    if (sessionId) {
      session = await Session.findById(sessionId);
    } else if (userId) {
      session = await Session.findOne({ user: userId }).sort({ createdAt: -1 });
    }

    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    // Mark session as completed
    session.isCompleted = true;
    session.completedAt = new Date();
    session.updatedAt = new Date();

    await session.save();

    // Calculate final session stats
    const totalQuestions = session.questionHistory.length;
    const correctAnswers = session.questionHistory.filter(
      (q) => q.score >= 0.7
    ).length;
    const accuracy =
      totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0;

    console.log(`Assessment session ${session._id} completed successfully`);

    res.json({
      success: true,
      message: "Assessment session ended successfully",
      sessionId: session._id,
      summary: {
        totalQuestions,
        correctAnswers,
        accuracy: Number(accuracy.toFixed(1)),
        duration: session.completedAt - session.createdAt,
        topicsCount: session.knowledgeStates.length,
      },
    });
  } catch (error) {
    console.error("Error ending assessment session:", error);
    res.status(500).json({
      error: "Failed to end assessment session",
      message: error.message,
    });
  }
});

// Get next question - Updated to include sessionId in question request
router.post("/question", async (req, res) => {
  try {
    const { topic, language, sessionId } = req.body;

    // Get session for context
    let session = null;
    if (sessionId) {
      session = await Session.findById(sessionId);
    }

    // Generate question using ollama service
    const questionData = await ollamaService.generateQuestion(
      topic || "Programming",
      session?.getCurrentMastery?.(topic) || 0.3,
      "coding problem",
      session?.getTopicHistory?.(topic) || {}
    );

    // Return question in expected format
    res.json({
      id: generateQuestionId(),
      question: questionData.question,
      content: questionData.question,
      topic: topic || "Programming",
      difficulty: questionData.difficulty || "Medium",
      questionId: questionData.questionId,
      currentMastery: questionData.currentMastery || 0.3,
    });
  } catch (error) {
    console.error("Error generating question:", error);
    res.status(500).json({ error: error.message });
  }
});

// Evaluate answer - Updated to work with new frontend format
router.post("/evaluate", async (req, res) => {
  try {
    const {
      question,
      answer,
      topic,
      language,
      sessionId,
      userId,
      questionId,
      difficulty,
    } = req.body;

    console.log("Evaluating answer:", {
      topic,
      language,
      sessionId,
      userId,
      answerLength: answer?.length,
    });

    // Evaluate using ollama service
    const evaluation = await ollamaService.evaluateAnswer(
      question,
      answer,
      topic,
      language || "python"
    );

    // The frontend will call /users/update-stats separately
    // So we just return the evaluation here
    res.json({
      feedback: evaluation.feedback,
      score: evaluation.score,
      suggestions: evaluation.suggestions || [],
      executionResult: evaluation.executionResult || null,
    });
  } catch (error) {
    console.error("Error evaluating answer:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get next question in sequence
router.post("/next-question", async (req, res) => {
  try {
    const { currentTopic, performance, language, sessionId } = req.body;

    // Get session for context
    let session = null;
    if (sessionId) {
      session = await Session.findById(sessionId);
    }

    // Determine next topic based on performance and current state
    let nextTopic = currentTopic;
    if (session) {
      const knowledgeState = {};
      session.knowledgeStates.forEach((ks) => {
        knowledgeState[ks.topic] = ks.mastery;
      });

      // Use ollama service to select optimal next topic
      nextTopic = ollamaService.selectNextTopic(
        knowledgeState,
        session.getSessionHistory?.() || {}
      );
    }

    const currentMastery = session?.getCurrentMastery?.(nextTopic) || 0.3;

    // Generate next question
    const questionData = await ollamaService.generateQuestion(
      nextTopic,
      currentMastery,
      "coding problem",
      session?.getTopicHistory?.(nextTopic) || {}
    );

    res.json({
      id: generateQuestionId(),
      content: questionData.question,
      question: questionData.question,
      topic: nextTopic,
      difficulty: questionData.difficulty || "Medium",
      currentMastery: questionData.currentMastery || currentMastery,
      questionId: questionData.questionId,
    });
  } catch (error) {
    console.error("Error getting next question:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get hint for current question
router.post("/hint", async (req, res) => {
  try {
    const { topic, attempt, language } = req.body;

    const hintData = await ollamaService.getAdaptiveHint(
      topic,
      0.3, // Default mastery for hints
      "",
      attempt || 1
    );

    res.json({
      hint:
        hintData.hint ||
        hintData.suggestion ||
        "Try breaking down the problem into smaller steps.",
    });
  } catch (error) {
    console.error("Error generating hint:", error);
    res.status(500).json({
      hint: "Think about the problem step by step. What's the first thing you need to do?",
    });
  }
});

// Generate next question
router.post("/question/generate", async (req, res) => {
  try {
    const { userId, topic, knowledgeState, sessionHistory, questionType } =
      req.body;

    // Get current session
    const session = await Session.findOne({ user: userId }).sort({
      createdAt: -1,
    });
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    // Determine topic if not specified
    let selectedTopic = topic;
    if (!selectedTopic) {
      selectedTopic = ollamaService.selectNextTopic(
        knowledgeState || {},
        sessionHistory || {}
      );
    }

    const currentMastery = knowledgeState?.[selectedTopic] || 0.0;

    // Generate question
    const questionData = await ollamaService.generateQuestion(
      selectedTopic,
      currentMastery,
      questionType || "coding problem",
      sessionHistory || {}
    );

    // Check prerequisites
    const prerequisiteCheck = ollamaService.checkPrerequisites(
      selectedTopic,
      knowledgeState || {}
    );

    res.json({
      success: true,
      ...questionData,
      prerequisites: prerequisiteCheck,
    });
  } catch (error) {
    console.error("Error generating question:", error);
    res.status(500).json({ error: error.message });
  }
});

// Submit and evaluate a single question answer
router.post("/submit-question", async (req, res) => {
  try {
    const {
      sessionId,
      userId,
      question,
      studentAnswer,
      topic,
      programmingLanguage,
      difficulty,
      timeSpent,
      currentMastery,
    } = req.body;

    // Get session by ID or userId (fallback)
    let session;
    if (sessionId) {
      session = await Session.findById(sessionId);
    } else if (userId) {
      session = await Session.findOne({ user: userId }).sort({ createdAt: -1 });
    }

    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    // Evaluate answer using Ollama
    const evaluation = await ollamaService.evaluateAnswer(
      question,
      studentAnswer,
      topic,
      programmingLanguage || "Python"
    );

    // Calculate new mastery
    const newMastery = ollamaService.calculateMasteryUpdate(
      currentMastery || 0.0,
      evaluation.score,
      difficulty || "medium"
    );

    // Create question record
    const questionRecord = {
      topic,
      question,
      answer: studentAnswer,
      userAnswer: studentAnswer,
      score: evaluation.score,
      difficulty: difficulty || "medium",
      programmingLanguage: programmingLanguage || "Python",
      timeSpent: timeSpent || 0,
      timestamp: new Date(),
      feedback: evaluation.feedback,
    };

    // Add question to history using the model method
    session.addQuestionHistory(questionRecord);

    // Update knowledge state using the model method
    const streak =
      evaluation.score >= 0.7
        ? (session.knowledgeStates.find((ks) => ks.topic === topic)?.streak ||
            0) + 1
        : 0;

    session.updateKnowledgeState(topic, newMastery, streak);

    await session.save();
    console.log("Session updated successfully with question submission");

    res.json({
      success: true,
      evaluation: {
        ...evaluation,
        newMastery,
        masteryChange: newMastery - (currentMastery || 0.0),
      },
      questionRecord,
      sessionId: session._id,
    });
  } catch (error) {
    console.error("Error submitting question:", error);
    res.status(500).json({ error: error.message });
  }
});

// Complete assessment session (legacy endpoint - redirects to /end)
router.post("/complete", async (req, res) => {
  try {
    req.url = "/end";
    return router.handle(req, res);
  } catch (error) {
    console.error("Error completing assessment:", error);
    res.status(500).json({ error: error.message });
  }
});

// Evaluate student answer (legacy endpoint - redirects to evaluate)
router.post("/answer/evaluate", async (req, res) => {
  try {
    req.url = "/evaluate";
    return router.handle(req, res);
  } catch (error) {
    console.error("Error evaluating answer:", error);
    res.status(500).json({ error: error.message });
  }
});

// Generate adaptive hint
router.post("/hint/generate", async (req, res) => {
  try {
    const { topic, currentMastery, questionContext, attemptNumber } = req.body;

    const hintData = await ollamaService.getAdaptiveHint(
      topic,
      currentMastery || 0.0,
      questionContext || "",
      attemptNumber || 1
    );

    res.json({
      success: true,
      ...hintData,
    });
  } catch (error) {
    console.error("Error generating hint:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get comprehensive analytics
router.get("/analytics/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    // Get most recent session from database
    const session = await Session.findOne({ user: userId })
      .sort({ updatedAt: -1 })
      .populate("user", "username email");

    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    // Generate analytics using Ollama service
    const analytics = await ollamaService.getLearningAnalytics({
      knowledgeStates: session.knowledgeStates,
      questionHistory: session.questionHistory,
    });

    res.json({
      success: true,
      analytics,
      user: session.user,
      sessionId: session._id,
    });
  } catch (error) {
    console.error("Error getting analytics:", error);
    res.status(500).json({ error: error.message });
  }
});

// Select optimal next topic
router.post("/topic/select", async (req, res) => {
  try {
    const { userId, knowledgeState, sessionHistory } = req.body;

    const selectedTopic = ollamaService.selectNextTopic(
      knowledgeState || {},
      sessionHistory || {}
    );

    const currentMastery = knowledgeState?.[selectedTopic] || 0.0;
    const prerequisiteCheck = ollamaService.checkPrerequisites(
      selectedTopic,
      knowledgeState || {}
    );

    res.json({
      success: true,
      selectedTopic,
      currentMastery,
      prerequisites: prerequisiteCheck,
      reason: "Optimal for your current learning level",
    });
  } catch (error) {
    console.error("Error selecting topic:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get session details
router.get("/session/:sessionId", async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = await Session.findById(sessionId);

    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    res.json(session);
  } catch (error) {
    console.error("Error fetching session:", error);
    res.status(500).json({
      error: "Failed to fetch session",
      message: error.message,
    });
  }
});

// Get learning path recommendations
router.post("/learning-path", async (req, res) => {
  try {
    const { userId, knowledgeState, sessionHistory } = req.body;

    const session = await Session.findOne({ user: userId }).sort({
      createdAt: -1,
    });
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    // Use current session data if not provided
    let currentKnowledge = knowledgeState;
    let currentHistory = sessionHistory;

    if (!currentKnowledge) {
      currentKnowledge = {};
      session.knowledgeStates.forEach((ks) => {
        currentKnowledge[ks.topic] = ks.mastery;
      });
    }

    if (!currentHistory) {
      currentHistory = {};
      session.questionHistory.forEach((q) => {
        if (!currentHistory[q.topic]) {
          currentHistory[q.topic] = [];
        }
        currentHistory[q.topic].push(q);
      });
    }

    const recommendations =
      ollamaService.generateLearningRecommendations?.(
        currentKnowledge,
        currentHistory
      ) || [];

    res.json({
      success: true,
      recommendations,
      nextTopic: ollamaService.selectNextTopic(
        currentKnowledge,
        currentHistory
      ),
    });
  } catch (error) {
    console.error("Error generating learning path:", error);
    res.status(500).json({ error: error.message });
  }
});

// Helper function to generate question IDs
function generateQuestionId() {
  return "q_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
}

module.exports = router;
