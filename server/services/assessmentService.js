// services/assessmentService.js
const Session = require("../models/Session");

class AssessmentService {
  /**
   * Complete an assessment session and update all relevant data
   * @param {Object} sessionData - The session data with question history
   * @param {string} userId - The user ID
   * @returns {Promise<Object>} - Updated session data
   */
  static async completeAssessment(sessionData, userId) {
    try {
      // Find or create session
      let session = await Session.findById(sessionData.sessionId);

      if (!session) {
        session = new Session({
          user: userId,
          knowledgeStates: [],
          questionHistory: [],
          currentStreaks: new Map(),
          learningVelocity: new Map(),
        });
      }

      // Process each question in the assessment
      if (sessionData.questions && sessionData.questions.length > 0) {
        sessionData.questions.forEach((questionData) => {
          // Add question to history
          session.addQuestionHistory({
            topic: questionData.topic,
            question: questionData.question,
            answer: questionData.correctAnswer,
            userAnswer: questionData.userAnswer,
            score: questionData.isCorrect ? 1 : 0,
            difficulty: questionData.difficulty,
            timeSpent: questionData.timeSpent || 0,
          });

          // Update knowledge state and streaks
          this.updateKnowledgeStateFromQuestion(session, questionData);
        });
      }

      // Mark session as completed
      session.isCompleted = true;
      session.sessionType = sessionData.type || "assessment";

      // Save the session
      await session.save();

      return session;
    } catch (error) {
      console.error("Error completing assessment:", error);
      throw error;
    }
  }

  /**
   * Update knowledge state based on question performance
   * @param {Object} session - The session object
   * @param {Object} questionData - The question data
   */
  static updateKnowledgeStateFromQuestion(session, questionData) {
    const { topic, isCorrect, difficulty } = questionData;

    // Find existing knowledge state for this topic
    let knowledgeState = session.knowledgeStates.find(
      (ks) => ks.topic === topic
    );

    if (!knowledgeState) {
      // Create new knowledge state
      knowledgeState = {
        topic,
        mastery: 0,
        lastPracticed: new Date(),
        streak: 0,
      };
      session.knowledgeStates.push(knowledgeState);
    }

    // Calculate mastery adjustment based on difficulty and correctness
    let masteryAdjustment = 0;

    if (isCorrect) {
      // Increase mastery more for harder questions
      switch (difficulty?.toLowerCase()) {
        case "easy":
          masteryAdjustment = 0.05;
          break;
        case "medium":
          masteryAdjustment = 0.1;
          break;
        case "hard":
          masteryAdjustment = 0.15;
          break;
        default:
          masteryAdjustment = 0.1;
      }

      // Update streak
      knowledgeState.streak = (knowledgeState.streak || 0) + 1;
    } else {
      // Decrease mastery more for easier questions if wrong
      switch (difficulty?.toLowerCase()) {
        case "easy":
          masteryAdjustment = -0.15;
          break;
        case "medium":
          masteryAdjustment = -0.1;
          break;
        case "hard":
          masteryAdjustment = -0.05;
          break;
        default:
          masteryAdjustment = -0.1;
      }

      // Reset streak
      knowledgeState.streak = 0;
    }

    // Apply mastery adjustment with bounds checking
    knowledgeState.mastery = Math.max(
      0,
      Math.min(1, knowledgeState.mastery + masteryAdjustment)
    );
    knowledgeState.lastPracticed = new Date();

    // Update session-level streak tracking
    session.currentStreaks.set(topic, knowledgeState.streak);
  }

  /**
   * Update session with individual question
   * @param {string} sessionId - The session ID
   * @param {Object} questionData - The question data
   * @returns {Promise<Object>} - Updated session
   */
  static async updateSessionWithQuestion(sessionId, questionData) {
    try {
      const session = await Session.findById(sessionId);

      if (!session) {
        throw new Error("Session not found");
      }

      // Add question to history
      session.addQuestionHistory({
        topic: questionData.topic,
        question: questionData.question,
        answer: questionData.correctAnswer,
        userAnswer: questionData.userAnswer,
        score: questionData.isCorrect ? 1 : 0,
        difficulty: questionData.difficulty,
        timeSpent: questionData.timeSpent || 0,
      });

      // Update knowledge state
      this.updateKnowledgeStateFromQuestion(session, questionData);

      // Save the session
      await session.save();

      return session;
    } catch (error) {
      console.error("Error updating session with question:", error);
      throw error;
    }
  }

  /**
   * Get latest session stats for a user
   * @param {string} userId - The user ID
   * @returns {Promise<Object>} - User stats
   */
  static async getUserStats(userId) {
    try {
      return await Session.getUserStats(userId);
    } catch (error) {
      console.error("Error getting user stats:", error);
      throw error;
    }
  }
}

module.exports = AssessmentService;
