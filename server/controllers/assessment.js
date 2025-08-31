const Session = require("../models/Session");
const ollamaService = require("../services/ollama");

// @desc    Start assessment session
// @route   POST /api/assessment/start
const startSession = async (req, res) => {
  try {
    const userId = req.user._id;

    // Get or create session
    let session = await Session.findOne({ user: userId });
    if (!session) {
      session = await Session.create({
        user: userId,
        knowledgeStates: Object.keys(initialKnowledgeStates).map((topic) => ({
          topic,
          mastery: 0,
        })),
      });
    }

    // Convert to format expected by Python agent
    const sessionData = {
      student_knowledge: session.knowledgeStates.reduce((acc, curr) => {
        acc[curr.topic] = curr.mastery;
        return acc;
      }, {}),
      session_stats: {}, // You'll need to implement this based on questionHistory
    };

    res.json(sessionData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// @desc    Get next question
// @route   POST /api/assessment/question
const getQuestion = async (req, res) => {
  try {
    const { topic, Mastery } = req.body;
    const question = await ollamaService.generateQuestion(topic, Mastery);
    res.json({ question });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// @desc    Evaluate answer
// @route   POST /api/assessment/evaluate
const evaluateAnswer = async (req, res) => {
  try {
    const { question, answer, topic, language } = req.body;
    const userId = req.user._id;

    // Get evaluation from Ollama
    const evaluation = await ollamaService.evaluateAnswer(
      question,
      answer,
      topic,
      language
    );

    // Update session in MongoDB
    await Session.findOneAndUpdate(
      { user: userId },
      {
        $push: {
          questionHistory: {
            topic,
            question,
            answer,
            score: evaluation.score,
            difficulty: evaluation.difficulty,
          },
        },
        $set: {
          [`knowledgeStates.$[elem].mastery`]: evaluation.newMastery,
          [`knowledgeStates.$[elem].lastPracticed`]: new Date(),
          [`currentStreaks.${topic}`]: evaluation.streak,
        },
      },
      {
        arrayFilters: [{ "elem.topic": topic }],
        new: true,
      }
    );

    res.json(evaluation);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  startSession,
  getQuestion,
  evaluateAnswer,
};
