const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Session = require("../models/Session");
const { authenticateToken } = require("../utils/jwt");

// Get user profile
router.get("/:id", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password");
    if (!user) return res.status(404).json({ msg: "User not found" });

    res.json({
      id: user._id,
      username: user.username,
      email: user.email,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin,
    });
  } catch (err) {
    res.status(500).json({ msg: "Server error", error: err.message });
  }
});

// Update user profile
router.put("/:id", authenticateToken, async (req, res) => {
  try {
    const { name, email } = req.body;
    const user = await User.findById(req.params.id);

    if (!user) return res.status(404).json({ msg: "User not found" });

    // Update fields if provided
    if (name) user.username = name;
    if (email) user.email = email;

    await user.save();

    res.json({
      id: user._id,
      username: user.username,
      email: user.email,
      createdAt: user.createdAt,
    });
  } catch (err) {
    res.status(500).json({ msg: "Server error", error: err.message });
  }
});

// **NEW ENDPOINT** - Update user statistics after each question
router.post("/update-stats", authenticateToken, async (req, res) => {
  try {
    const { userId, sessionId, questionData } = req.body;

    console.log("Updating user stats:", { userId, sessionId, questionData });

    // Validate required fields
    if (!userId || !questionData) {
      return res.status(400).json({
        error: "Missing required fields: userId and questionData",
      });
    }

    // Find the session to update
    let session;
    if (sessionId) {
      session = await Session.findById(sessionId);
    } else {
      session = await Session.findOne({ user: userId }).sort({ createdAt: -1 });
    }

    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    // Create question record for session history
    const questionRecord = {
      topic: questionData.topic,
      difficulty: questionData.difficulty,
      score: questionData.score,
      result: questionData.result,
      language: questionData.language,
      timeSpent: questionData.timeSpent || 30, // Default 30 seconds if not provided
      timestamp: questionData.timestamp || new Date(),
      userAnswer: questionData.userAnswer || "",
      question: questionData.question || "",
    };

    // Add to question history
    session.addQuestionHistory(questionRecord);

    // Update knowledge state for this topic
    const currentKnowledgeState = session.knowledgeStates.find(
      (ks) => ks.topic === questionData.topic
    );

    const currentMastery = currentKnowledgeState?.mastery || 0.3; // Default starting mastery
    const currentStreak = currentKnowledgeState?.streak || 0;

    // Calculate new mastery based on performance
    let masteryChange = 0;
    if (questionData.score >= 0.8) {
      masteryChange = 0.15; // Excellent performance
    } else if (questionData.score >= 0.6) {
      masteryChange = 0.1; // Good performance
    } else if (questionData.score >= 0.4) {
      masteryChange = 0.05; // Fair performance
    } else {
      masteryChange = -0.05; // Poor performance (slight decrease)
    }

    // Apply difficulty multiplier
    const difficultyMultiplier = {
      easy: 0.8,
      medium: 1.0,
      hard: 1.2,
    };
    masteryChange *=
      difficultyMultiplier[questionData.difficulty.toLowerCase()] || 1.0;

    const newMastery = Math.max(0, Math.min(1, currentMastery + masteryChange));

    // Update streak
    const newStreak = questionData.result === "Correct" ? currentStreak + 1 : 0;

    // Update knowledge state
    session.updateKnowledgeState(questionData.topic, newMastery, newStreak);

    // Update learning velocity (questions per topic in this session)
    const topicQuestions = session.questionHistory.filter(
      (q) => q.topic === questionData.topic
    );
    const currentVelocity =
      session.learningVelocity.get(questionData.topic) || 0;
    session.learningVelocity.set(questionData.topic, currentVelocity + 1);

    // Update current streaks
    session.currentStreaks.set(questionData.topic, newStreak);

    // Save session
    await session.save();

    console.log(`Updated session ${session._id} with new question data`);

    res.json({
      success: true,
      message: "User stats updated successfully",
      sessionId: session._id,
      newMastery,
      masteryChange,
      newStreak,
      questionCount: session.questionHistory.length,
    });
  } catch (error) {
    console.error("Error updating user stats:", error);
    res.status(500).json({
      error: "Failed to update user statistics",
      message: error.message,
    });
  }
});

// Get user learning statistics
router.get("/:id/stats", authenticateToken, async (req, res) => {
  try {
    const userId = req.params.id;

    // Verify user exists
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: "User not found" });

    // Find all sessions for this user
    const sessions = await Session.find({ user: userId }).sort({
      updatedAt: -1,
    });

    if (!sessions || sessions.length === 0) {
      // Return empty stats if no sessions found
      return res.json({
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
      });
    }

    // Aggregate data from all sessions
    let totalQuestions = 0;
    let correctAnswers = 0;
    let totalTimeSpent = 0;
    let allQuestionHistory = [];
    let knowledgeStatesMap = new Map();
    let currentStreaks = {};
    let learningVelocity = {};

    // Process each session
    sessions.forEach((session) => {
      // Aggregate question history
      if (session.questionHistory && session.questionHistory.length > 0) {
        session.questionHistory.forEach((q) => {
          totalQuestions++;
          totalTimeSpent += q.timeSpent || 30; // Default 30 seconds if not recorded
          if (q.score >= 0.7) {
            // Assuming score >= 0.7 is correct
            correctAnswers++;
          }
          allQuestionHistory.push(q);
        });
      }

      // Aggregate knowledge states (keep the most recent mastery for each topic)
      if (session.knowledgeStates && session.knowledgeStates.length > 0) {
        session.knowledgeStates.forEach((ks) => {
          if (
            !knowledgeStatesMap.has(ks.topic) ||
            (ks.lastPracticed &&
              ks.lastPracticed > knowledgeStatesMap.get(ks.topic).lastPracticed)
          ) {
            knowledgeStatesMap.set(ks.topic, ks);
          }
        });
      }

      // Aggregate streaks and learning velocity
      if (session.currentStreaks) {
        const streaksObj = session.currentStreaks.toObject
          ? session.currentStreaks.toObject()
          : session.currentStreaks;
        Object.entries(streaksObj).forEach(([topic, streak]) => {
          currentStreaks[topic] = Math.max(currentStreaks[topic] || 0, streak);
        });
      }

      if (session.learningVelocity) {
        const velocityObj = session.learningVelocity.toObject
          ? session.learningVelocity.toObject()
          : session.learningVelocity;
        Object.entries(velocityObj).forEach(([topic, velocity]) => {
          learningVelocity[topic] = velocity;
        });
      }
    });

    // Calculate accuracy
    const accuracy =
      totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0;

    // Calculate average time per question
    const avgTimeSeconds =
      totalQuestions > 0 ? totalTimeSpent / totalQuestions : 0;
    const minutes = Math.floor(avgTimeSeconds / 60);
    const seconds = Math.floor(avgTimeSeconds % 60);
    const avgTimePerQuestion = `${minutes}m ${seconds}s`;

    // Convert knowledge states map to object
    const knowledgeStates = {};
    knowledgeStatesMap.forEach((value, key) => {
      knowledgeStates[key] = value.mastery;
    });

    // Find strongest and weakest concepts
    let strongestConcept = "";
    let weakestConcept = "";
    let highestMastery = -1;
    let lowestMastery = 2;

    Object.entries(knowledgeStates).forEach(([topic, mastery]) => {
      if (mastery > highestMastery) {
        highestMastery = mastery;
        strongestConcept = topic;
      }
      if (mastery < lowestMastery) {
        lowestMastery = mastery;
        weakestConcept = topic;
      }
    });

    // Get recent activities (last 10)
    const recentActivities = allQuestionHistory
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 10)
      .map((q) => ({
        concept: q.topic || "Unknown",
        difficulty: q.difficulty || "Medium",
        result: q.score >= 0.7 ? "Correct" : "Incorrect",
        timestamp: q.timestamp,
      }));

    const stats = {
      totalQuestionsAnswered: totalQuestions,
      correctAnswers,
      accuracy: Number(accuracy.toFixed(1)),
      strongestConcept,
      weakestConcept,
      avgTimePerQuestion,
      knowledgeStates,
      recentActivities,
      currentStreaks,
      learningVelocity,
    };

    console.log(`Returning stats for user ${userId}:`, stats);
    res.json(stats);
  } catch (error) {
    console.error("Error fetching user stats:", error);
    res.status(500).json({
      error: "Failed to fetch user statistics",
      message: error.message,
    });
  }
});

module.exports = router;
