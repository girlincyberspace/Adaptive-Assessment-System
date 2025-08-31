const express = require("express");
const router = express.Router();
const ollamaService = require("../services/ollama");
const sessionService = require("../services/session");
const auth = require("../middleware/auth");
const Session = require("../models/Session");

router.use(auth);

// Start a new assessment session - THIS IS THE MISSING ENDPOINT
router.post("/assessment/start", async (req, res) => {
  try {
    const { userId } = req.body;

    console.log("Starting assessment for userId:", userId);

    // Create or get existing session
    let session = await Session.findOne({ user: userId });

    if (!session) {
      // Create new session
      const sessionData = await ollamaService.startSession(userId);
      session = await sessionService.createSession(userId, sessionData);
    }

    // Return session data that frontend expects
    const responseData = {
      sessionId: session._id,
      userId: userId,
      knowledgeStates: session.knowledgeStates || [],
      currentTopic: session.currentTopic || null,
      questionCount: session.questionHistory?.length || 0,
    };

    console.log("Assessment session response:", responseData);

    res.json(responseData);
  } catch (error) {
    console.error("Error starting assessment:", error);
    res.status(500).json({
      error: error.message,
      details: "Failed to initialize assessment session",
    });
  }
});

// Original start endpoint (maybe for different purpose?)
router.post("/start", async (req, res) => {
  try {
    const { userId } = req.body;
    const sessionData = await ollamaService.startSession(userId);
    sessionService.createSession(userId, sessionData);
    res.json(sessionData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get next question
router.post("/question", async (req, res) => {
  try {
    const { userId, topic, Mastery } = req.body;
    const question = await ollamaService.generateQuestion(topic, Mastery);
    res.json({ question });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Evaluate answer
router.post("/evaluate", async (req, res) => {
  try {
    const { userId, question, answer, topic, language } = req.body;
    const evaluation = await ollamaService.evaluateAnswer(
      question,
      answer,
      topic,
      language
    );

    // Update session with evaluation results
    sessionService.updateSession(userId, topic, evaluation);

    res.json(evaluation);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get hint
router.post("/hint", async (req, res) => {
  try {
    const { topic, Mastery, context, attempt } = req.body;
    const hint = await ollamaService.getAdaptiveHint(
      topic,
      Mastery,
      context,
      attempt
    );
    res.json({ hint });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get analytics
router.get("/analytics/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const analytics = await ollamaService.getLearningAnalytics(userId);
    res.json(analytics);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get user stats
router.get("/users/:userId/stats", async (req, res) => {
  try {
    const { userId } = req.params;

    // Get user session from MongoDB
    const session = await Session.findOne({ user: userId }).populate(
      "user",
      "name email createdAt"
    );

    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    // Calculate stats
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

    // Get recent activities
    const recentActivities = session.questionHistory
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 5)
      .map((q) => ({
        concept: q.topic,
        difficulty: q.difficulty,
        result: q.score >= 0.7 ? "Correct" : "Incorrect",
        timestamp: q.timestamp,
      }));

    res.json({
      totalQuestionsAnswered: totalQuestions,
      correctAnswers,
      accuracy,
      strongestConcept,
      weakestConcept,
      avgTimePerQuestion: "1m 24s", // You'd calculate this from actual data
      knowledgeStates: session.knowledgeStates.reduce((acc, curr) => {
        acc[curr.topic] = curr.mastery;
        return acc;
      }, {}),
      recentActivities,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get next question in assessment
router.post("/assessment/next-question", async (req, res) => {
  try {
    const { currentTopic, performance } = req.body;

    // Get recommended next topic from Python agent
    const nextTopic = await ollamaService.getNextRecommendedTopic(
      currentTopic,
      performance
    );

    // Generate question
    const question = await ollamaService.generateQuestion(
      nextTopic,
      req.session.knowledgeStates[nextTopic] || 0
    );

    res.json({
      id: generateQuestionId(),
      content: question,
      topic: nextTopic,
      difficulty: "Medium", // Would come from Python agent
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Helper function to generate question IDs
function generateQuestionId() {
  return "q_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
}

module.exports = router;
