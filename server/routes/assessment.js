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
router.post("/assessment/start", async (req, res) => {
  try {
    const { userId } = req.body;

    console.log("Starting assessment for userId:", userId);

    // Get or create session from MongoDB
    let session = await Session.findOne({ user: userId });

    if (!session) {
      // Create new session using Ollama service
      const sessionData = await ollamaService.startSession(userId);
      session = await sessionService.createSession(userId, sessionData);
    }

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
    console.error("Error in /assessment/start:", err);
    res.status(500).json({
      msg: "Server error",
      error: err.message,
      stack: err.stack,
    });
  }
});

// Generate next question
router.post("/question/generate", async (req, res) => {
  try {
    const { userId, topic, knowledgeState, sessionHistory, questionType } =
      req.body;

    // Get current session
    const session = await Session.findOne({ user: userId });
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

// Evaluate student answer
router.post("/answer/evaluate", async (req, res) => {
  try {
    const {
      userId,
      question,
      studentAnswer,
      topic,
      programmingLanguage,
      difficulty,
      currentMastery,
    } = req.body;

    // Get session
    const session = await Session.findOne({ user: userId });
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
      score: evaluation.score,
      difficulty: difficulty || "medium",
      programmingLanguage: programmingLanguage || "Python",
      timestamp: new Date(),
      feedback: evaluation.feedback,
    };

    // Update session in database
    try {
      // Add question to history
      session.questionHistory.push(questionRecord);

      // Update knowledge state
      const knowledgeStateIndex = session.knowledgeStates.findIndex(
        (ks) => ks.topic === topic
      );
      if (knowledgeStateIndex !== -1) {
        session.knowledgeStates[knowledgeStateIndex].mastery = newMastery;
        session.knowledgeStates[knowledgeStateIndex].lastPracticed = new Date();

        // Update streak
        if (evaluation.score >= 0.7) {
          session.knowledgeStates[knowledgeStateIndex].streak =
            Math.max(0, session.knowledgeStates[knowledgeStateIndex].streak) +
            1;
        } else {
          session.knowledgeStates[knowledgeStateIndex].streak =
            Math.min(0, session.knowledgeStates[knowledgeStateIndex].streak) -
            1;
        }
      }

      await session.save();
      console.log("Session updated successfully");
    } catch (dbError) {
      console.error("Database update error:", dbError);
      // Continue with response even if DB update fails
    }

    res.json({
      success: true,
      evaluation: {
        ...evaluation,
        newMastery,
        masteryChange: newMastery - (currentMastery || 0.0),
      },
      questionRecord,
    });
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

    // Get session from database
    const session = await Session.findOne({ user: userId }).populate(
      "user",
      "name email"
    );
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
    });
  } catch (error) {
    console.error("Error getting analytics:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get user stats (optimized version of your existing endpoint)
router.get("/users/:userId/stats", async (req, res) => {
  try {
    const { userId } = req.params;

    const session = await Session.findOne({ user: userId }).populate(
      "user",
      "name email createdAt"
    );

    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    // Calculate basic stats
    const totalQuestions = session.questionHistory.length;
    const correctAnswers = session.questionHistory.filter(
      (q) => q.score >= 0.7
    ).length;
    const accuracy =
      totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0;

    // Find strongest/weakest concepts
    let strongestConcept = "";
    let weakestConcept = "";
    let maxMastery = 0;
    let minMastery = 1;

    session.knowledgeStates.forEach((ks) => {
      if (ks.mastery > maxMastery) {
        maxMastery = ks.mastery;
        strongestConcept = ks.topic;
      }
      if (ks.mastery < minMastery) {
        minMastery = ks.mastery;
        weakestConcept = ks.topic;
      }
    });

    // Recent activities
    const recentActivities = session.questionHistory
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 5)
      .map((q) => ({
        concept: q.topic,
        difficulty: q.difficulty,
        result: q.score >= 0.7 ? "Correct" : "Incorrect",
        timestamp: q.timestamp,
        score: q.score,
      }));

    // Knowledge states as object
    const knowledgeStatesObj = session.knowledgeStates.reduce((acc, curr) => {
      acc[curr.topic] = curr.mastery;
      return acc;
    }, {});

    res.json({
      totalQuestionsAnswered: totalQuestions,
      correctAnswers,
      accuracy: Math.round(accuracy),
      strongestConcept,
      weakestConcept,
      avgTimePerQuestion: "1m 24s", // Calculate from actual data if available
      knowledgeStates: knowledgeStatesObj,
      recentActivities,
      user: session.user,
    });
  } catch (error) {
    console.error("Error getting user stats:", error);
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

// Get next question in assessment (updated to use new service)
router.post("/assessment/next-question", async (req, res) => {
  try {
    const { userId, currentTopic, performance } = req.body;

    // Get session
    const session = await Session.findOne({ user: userId });
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    // Convert session data
    const knowledgeState = {};
    session.knowledgeStates.forEach((ks) => {
      knowledgeState[ks.topic] = ks.mastery;
    });

    const sessionHistory = {};
    session.questionHistory.forEach((q) => {
      if (!sessionHistory[q.topic]) {
        sessionHistory[q.topic] = [];
      }
      sessionHistory[q.topic].push(q);
    });

    // Get next recommended topic
    const nextTopic =
      currentTopic ||
      ollamaService.getNextRecommendedTopic(knowledgeState, sessionHistory);
    const currentMastery = knowledgeState[nextTopic] || 0.0;

    // Generate question
    const questionData = await ollamaService.generateQuestion(
      nextTopic,
      currentMastery,
      "coding problem",
      sessionHistory
    );

    res.json({
      id: generateQuestionId(),
      content: questionData.question,
      topic: nextTopic,
      difficulty: questionData.difficulty,
      currentMastery: questionData.currentMastery,
      questionId: questionData.questionId,
    });
  } catch (error) {
    console.error("Error getting next question:", error);
    res.status(500).json({ error: error.message });
  }
});

// Update session with performance data
router.post("/session/update", async (req, res) => {
  try {
    const { userId, topic, score, difficulty, question, answer, timeSpent } =
      req.body;

    const session = await Session.findOne({ user: userId });
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    // Create performance record
    const performanceRecord = {
      topic,
      question,
      answer,
      score,
      difficulty,
      timeSpent: timeSpent || 0,
      timestamp: new Date(),
    };

    // Add to question history
    session.questionHistory.push(performanceRecord);

    // Update knowledge state
    const knowledgeStateIndex = session.knowledgeStates.findIndex(
      (ks) => ks.topic === topic
    );
    if (knowledgeStateIndex !== -1) {
      const currentMastery =
        session.knowledgeStates[knowledgeStateIndex].mastery;
      const newMastery = ollamaService.calculateMasteryUpdate(
        currentMastery,
        score,
        difficulty
      );

      session.knowledgeStates[knowledgeStateIndex].mastery = newMastery;
      session.knowledgeStates[knowledgeStateIndex].lastPracticed = new Date();

      // Update streak
      if (score >= 0.7) {
        session.knowledgeStates[knowledgeStateIndex].streak =
          Math.max(0, session.knowledgeStates[knowledgeStateIndex].streak) + 1;
      } else {
        session.knowledgeStates[knowledgeStateIndex].streak =
          Math.min(0, session.knowledgeStates[knowledgeStateIndex].streak) - 1;
      }
    }

    await session.save();

    res.json({
      success: true,
      message: "Session updated successfully",
      newMastery: session.knowledgeStates[knowledgeStateIndex]?.mastery || 0,
      streak: session.knowledgeStates[knowledgeStateIndex]?.streak || 0,
    });
  } catch (error) {
    console.error("Error updating session:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get learning path recommendations
router.post("/learning-path", async (req, res) => {
  try {
    const { userId, knowledgeState, sessionHistory } = req.body;

    const session = await Session.findOne({ user: userId });
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

    const recommendations = ollamaService.generateLearningRecommendations(
      currentKnowledge,
      currentHistory
    );

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

// Legacy endpoints (keeping for backward compatibility)

// Original start endpoint
router.post("/start", async (req, res) => {
  try {
    const { userId } = req.body;
    const sessionData = await ollamaService.startSession(userId);
    await sessionService.createSession(userId, sessionData);
    res.json(sessionData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Original question endpoint
router.post("/question", async (req, res) => {
  try {
    const { userId, topic, Mastery } = req.body;

    const questionData = await ollamaService.generateQuestion(
      topic,
      Mastery || 0.0,
      "coding problem"
    );

    res.json({ question: questionData.question });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Original evaluate endpoint (keeping your existing logic)
router.post("/evaluate", async (req, res) => {
  try {
    const { userId, question, answer, topic, language } = req.body;

    const evaluation = await ollamaService.evaluateAnswer(
      question,
      answer,
      topic,
      language || "Python"
    );

    // Update session with evaluation results
    await sessionService.updateSession(userId, topic, evaluation);

    res.json(evaluation);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Original hint endpoint
router.post("/hint", async (req, res) => {
  try {
    const { topic, Mastery, context, attempt } = req.body;

    const hintData = await ollamaService.getAdaptiveHint(
      topic,
      Mastery || 0.0,
      context || "",
      attempt || 1
    );

    res.json({ hint: hintData.hint });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Helper function to generate question IDs
function generateQuestionId() {
  return "q_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
}

module.exports = router;
