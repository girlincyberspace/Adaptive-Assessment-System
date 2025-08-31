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
  lastPracticed: Date,
  streak: {
    type: Number,
    default: 0,
  },
});

const QuestionHistorySchema = new mongoose.Schema({
  topic: String,
  question: String,
  answer: String,
  score: Number,
  difficulty: String,
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
  currentStreaks: Map,
  learningVelocity: Map,
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

module.exports = mongoose.model("Session", SessionSchema);
