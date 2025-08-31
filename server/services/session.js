// services/session.js
const Session = require("../models/Session");

class SessionService {
  static async createSession(userId, initialData = {}) {
    try {
      const session = new Session({
        user: userId,
        knowledgeStates: Object.keys(initialData.student_knowledge || {}).map(
          (topic) => ({
            topic,
            mastery: initialData.student_knowledge[topic] || 0,
          })
        ),
        questionHistory: [],
      });
      return await session.save();
    } catch (error) {
      console.error("Error creating session:", error);
      throw error;
    }
  }

  static async getSession(userId) {
    try {
      return await Session.findOne({ user: userId });
    } catch (error) {
      console.error("Error getting session:", error);
      throw error;
    }
  }

  static async updateSession(userId, topic, evaluation) {
    try {
      return await Session.findOneAndUpdate(
        { user: userId },
        {
          $push: {
            questionHistory: {
              topic,
              question: evaluation.question,
              answer: evaluation.answer,
              score: evaluation.score,
              difficulty: evaluation.difficulty,
            },
          },
          $set: {
            [`knowledgeStates.$[elem].mastery`]: evaluation.newMastery,
            [`knowledgeStates.$[elem].lastPracticed`]: new Date(),
          },
        },
        {
          arrayFilters: [{ "elem.topic": topic }],
          new: true,
        }
      );
    } catch (error) {
      console.error("Error updating session:", error);
      throw error;
    }
  }
}

module.exports = SessionService;
