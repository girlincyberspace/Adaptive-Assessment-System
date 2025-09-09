const mongoose = require("mongoose");

const KnowledgeStateSchema = new mongoose.Schema({
  topic: {
    type: String,
    required: true,
  },
  mastery: {
    type: Number,
    default: 0,
    min: 0,
    max: 1,
  },
  lastPracticed: {
    type: Date,
    default: Date.now,
  },
  streak: {
    type: Number,
    default: 0,
  },
});

const QuestionHistorySchema = new mongoose.Schema({
  topic: {
    type: String,
    required: true,
  },
  question: String,
  answer: String,
  userAnswer: String,
  score: {
    type: Number,
    min: 0,
    max: 1,
  },
  difficulty: {
    type: String,
    enum: ["Easy", "Medium", "Hard"],
    default: "Medium",
  },
  timeSpent: {
    type: Number, // Time in seconds
    default: 0,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

const SessionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  knowledgeStates: [KnowledgeStateSchema],
  questionHistory: [QuestionHistorySchema],
  currentStreaks: {
    type: Map,
    of: Number,
    default: new Map(),
  },
  learningVelocity: {
    type: Map,
    of: Number,
    default: new Map(),
  },
  sessionType: {
    type: String,
    enum: ["assessment", "practice", "review"],
    default: "assessment",
  },
  isCompleted: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Update timestamp before saving
SessionSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

// Method to update knowledge state for a topic
SessionSchema.methods.updateKnowledgeState = function (
  topic,
  newMastery,
  streak = 0
) {
  let knowledgeState = this.knowledgeStates.find((ks) => ks.topic === topic);

  if (knowledgeState) {
    knowledgeState.mastery = newMastery;
    knowledgeState.lastPracticed = new Date();
    knowledgeState.streak = streak;
  } else {
    this.knowledgeStates.push({
      topic,
      mastery: newMastery,
      lastPracticed: new Date(),
      streak,
    });
  }

  // Update current streaks map
  this.currentStreaks.set(topic, streak);
};

// Method to add question to history
SessionSchema.methods.addQuestionHistory = function (questionData) {
  const {
    topic,
    question,
    answer,
    userAnswer,
    score,
    difficulty = "Medium",
    timeSpent = 0,
  } = questionData;

  this.questionHistory.push({
    topic,
    question,
    answer,
    userAnswer,
    score,
    difficulty,
    timeSpent,
    timestamp: new Date(),
  });

  // Update learning velocity (questions per hour for this topic)
  const topicQuestions = this.questionHistory.filter((q) => q.topic === topic);
  if (topicQuestions.length >= 2) {
    const firstQuestionTime = topicQuestions[0].timestamp;
    const lastQuestionTime =
      topicQuestions[topicQuestions.length - 1].timestamp;
    const hoursDiff = (lastQuestionTime - firstQuestionTime) / (1000 * 60 * 60);
    const velocity = hoursDiff > 0 ? topicQuestions.length / hoursDiff : 0;
    this.learningVelocity.set(topic, velocity);
  }
};

// Static method to get user statistics
SessionSchema.statics.getUserStats = async function (userId) {
  try {
    const sessions = await this.find({ user: userId }).sort({ updatedAt: -1 });

    if (!sessions || sessions.length === 0) {
      return {
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
    }

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
          totalTimeSpent += q.timeSpent || 0;
          if (q.score >= 0.7) {
            correctAnswers++;
          }
          allQuestionHistory.push(q);
        });
      }

      // Get latest knowledge states
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

      // Get current streaks and learning velocity
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

    // Calculate average time per question
    const avgTimeSeconds =
      totalQuestions > 0 ? totalTimeSpent / totalQuestions : 0;
    const minutes = Math.floor(avgTimeSeconds / 60);
    const seconds = Math.floor(avgTimeSeconds % 60);
    const avgTimePerQuestion = `${minutes}m ${seconds}s`;

    // Calculate accuracy
    const accuracy =
      totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0;

    // Convert knowledge states to object
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

    // Get recent activities
    const recentActivities = allQuestionHistory
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 10)
      .map((q) => ({
        concept: q.topic || "Unknown",
        difficulty: q.difficulty || "Medium",
        result: q.score >= 0.7 ? "Correct" : "Incorrect",
        timestamp: q.timestamp,
      }));

    return {
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
  } catch (error) {
    console.error("Error calculating user stats:", error);
    throw error;
  }
};

module.exports = mongoose.model("Session", SessionSchema);
