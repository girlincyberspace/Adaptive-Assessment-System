// services/ollama.js
const axios = require("axios");

class OllamaService {
  constructor() {
    this.ollamaUrl = "http://127.0.0.1:11434"; // Default Ollama URL
    this.llmModel = "llama3.2";
    this.embeddingModel = "nomic-embed-text";

    // Default knowledge states
    this.defaultKnowledge = {
      Arrays: 0.0,
      "Linked Lists": 0.0,
      Stacks: 0.0,
      Queues: 0.0,
      Trees: 0.0,
      "Binary Search Trees": 0.0,
      "Hash Tables": 0.0,
      Graphs: 0.0,
      "Linear Search": 0.0,
      "Binary Search": 0.0,
      "Sorting Algorithms": 0.0,
      "Dynamic Programming": 0.0,
      Recursion: 0.0,
      "Big O Notation": 0.0,
    };

    this.weightedPrerequisites = {
      "Binary Search Trees": [
        ["Trees", 0.8],
        ["Binary Search", 0.6],
      ],
      Graphs: [["Trees", 0.7]],
      "Dynamic Programming": [["Recursion", 0.9]],
      "Hash Tables": [["Arrays", 0.6]],
      "Sorting Algorithms": [["Arrays", 0.8]],
      Recursion: [["Big O Notation", 0.4]],
      Trees: [["Linked Lists", 0.5]],
      Stacks: [["Arrays", 0.4]],
      Queues: [["Arrays", 0.4]],
    };
  }

  async checkOllamaHealth() {
    try {
      const response = await axios.get(`${this.ollamaUrl}/api/tags`);
      return {
        status: "healthy",
        models: response.data.models?.map((m) => m.name) || [],
      };
    } catch (error) {
      return {
        status: "unhealthy",
        error: error.message,
      };
    }
  }

  async generateWithOllama(model, prompt, options = {}) {
    try {
      const response = await axios.post(`${this.ollamaUrl}/api/generate`, {
        model: model,
        prompt: prompt,
        stream: false,
        options: {
          temperature: options.temperature || 0.7,
          ...options,
        },
      });

      return response.data.response;
    } catch (error) {
      throw new Error(`Ollama generation failed: ${error.message}`);
    }
  }

  checkPrerequisites(topic, knowledgeState) {
    if (!this.weightedPrerequisites[topic]) {
      return { canProceed: true, missingPrereqs: [] };
    }

    const missingPrereqs = [];
    for (const [prereq, weight] of this.weightedPrerequisites[topic]) {
      const mastery = knowledgeState[prereq] || 0;
      const requiredThreshold = 0.3 + weight * 0.3;

      if (mastery < requiredThreshold) {
        missingPrereqs.push(prereq);
      }
    }

    return {
      canProceed: missingPrereqs.length === 0,
      missingPrereqs,
    };
  }

  adjustDifficulty(topic, mastery, performanceHistory = []) {
    const recentScores = performanceHistory.slice(-5);
    const theta =
      recentScores.length > 0
        ? recentScores.reduce((sum, score) => sum + score, 0) /
          recentScores.length
        : 0.5;

    if (theta < 0.3) return "easy";
    if (theta < 0.6) return "medium";
    return "hard";
  }

  selectNextTopic(knowledgeState, sessionHistory = {}) {
    const topicScores = {};

    // Never attempted topics
    const neverAttempted = Object.keys(knowledgeState).filter(
      (topic) => !sessionHistory[topic] || sessionHistory[topic].length === 0
    );

    for (const topic of Object.keys(knowledgeState)) {
      let score = 0.0;
      const mastery = knowledgeState[topic];

      // Exploration bonus
      if (neverAttempted.includes(topic)) {
        score += 0.4;
      }

      // Mastery gap factor
      if (mastery < 0.3) score += 0.3;
      else if (mastery < 0.6) score += 0.2;
      else score += 0.1;

      // Prerequisites check
      const { canProceed } = this.checkPrerequisites(topic, knowledgeState);
      if (canProceed) {
        score += 0.3;
      } else {
        score *= 0.1;
      }

      topicScores[topic] = score;
    }

    // Return topic with highest score
    return Object.keys(topicScores).reduce((a, b) =>
      topicScores[a] > topicScores[b] ? a : b
    );
  }

  async generateQuestion(
    topic,
    currentMastery,
    questionType = "coding problem",
    sessionHistory = {}
  ) {
    try {
      const difficulty = this.adjustDifficulty(
        topic,
        currentMastery,
        sessionHistory[topic]?.map((q) => q.score) || []
      );

      const prompt = `You are an expert Data Structures and Algorithms instructor creating high-quality assessment questions.

STUDENT CONTEXT:
- Topic: ${topic}
- Current mastery: ${currentMastery.toFixed(1)}/1.0 (${difficulty} level)
- Question type: ${questionType}

INSTRUCTIONS:
Generate a ${difficulty} ${questionType} focused on "${topic}".

FOR CODING PROBLEMS:
1. **Problem Statement**: Write a clear, engaging problem description
   - Start with real-world context when possible
   - Be specific about input/output requirements
   - Make it solvable using the topic's core concepts

2. **Function Signature**: Provide an empty function template in Python:
   \`\`\`python
   def function_name(parameters):
       # Your code here
       pass
   \`\`\`

3. **Examples**: Show 2-3 carefully crafted input/output examples:
   - Example 1: Simple case demonstrating basic functionality
   - Example 2: Edge case (empty input, boundaries, special conditions)
   - Example 3: More complex case if needed

4. **Constraints**: List clear, reasonable constraints

DIFFICULTY GUIDELINES:
- Easy: Single concept, straightforward implementation, obvious approach
- Medium: Multiple steps, some algorithmic thinking, moderate optimization
- Hard: Complex logic, multiple concepts, efficiency critical, edge cases important

Generate a thoughtful, well-crafted question:`;

      const question = await this.generateWithOllama(this.llmModel, prompt);

      return {
        question,
        topic,
        difficulty,
        currentMastery,
        questionId: `${topic}_${Date.now()}`,
      };
    } catch (error) {
      throw new Error(`Question generation failed: ${error.message}`);
    }
  }

  async evaluateAnswer(
    question,
    studentAnswer,
    topic,
    programmingLanguage = "Python"
  ) {
    try {
      const prompt = `You are an expert Data Structures and Algorithms grader providing comprehensive, educational feedback.

ASSESSMENT CONTEXT:
- Question: ${question}
- Student's Answer (${programmingLanguage}): ${studentAnswer}
- Topic: ${topic}

EVALUATION FRAMEWORK:
1. **CORRECTNESS ANALYSIS** (50% weight):
   - Does the solution solve the problem correctly?
   - Test against provided examples step-by-step
   - Identify any logical errors or bugs

2. **ALGORITHMIC UNDERSTANDING** (25% weight):
   - Is the approach appropriate for ${topic}?
   - Does it demonstrate understanding of key concepts?

3. **CODE QUALITY** (15% weight):
   - Code readability and organization
   - Variable naming and style

4. **COMPLETENESS** (10% weight):
   - Handles specified edge cases
   - Addresses all requirements

FEEDBACK STRUCTURE:
**Overall Assessment**: [Excellent/Good/Satisfactory/Needs Improvement/Incorrect]

**What You Did Well**: 
- Specific positive aspects of the solution

**Areas for Improvement**:
- Specific issues identified (be precise about what's wrong)

**Learning Recommendations**:
- Specific topics to study
- Concepts to practice

**Key Insights**: Brief explanation of the main concept

SCORING RUBRIC:
- 0.9-1.0: Excellent - Correct, efficient, well-written
- 0.7-0.8: Good - Mostly correct with minor issues
- 0.5-0.6: Satisfactory - Core logic correct but notable problems
- 0.3-0.4: Needs work - Shows understanding but significant errors
- 0.1-0.2: Poor - Major misconceptions or errors
- 0.0: Incorrect - No meaningful progress toward solution

Be encouraging while being precise about areas for improvement.

**FINAL_SCORE:** [score between 0.0 and 1.0]`;

      const feedback = await this.generateWithOllama(this.llmModel, prompt);
      const score = this.parseScoreFromFeedback(feedback);

      return {
        feedback,
        score,
        topic,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw new Error(`Answer evaluation failed: ${error.message}`);
    }
  }

  parseScoreFromFeedback(feedback) {
    const patterns = [
      /\*\*FINAL_SCORE:\*\*\s*([0-9]*\.?[0-9]+)/i,
      /FINAL_SCORE:\s*([0-9]*\.?[0-9]+)/i,
      /Score:\s*([0-9]*\.?[0-9]+)/i,
      /([0-9]*\.?[0-9]+)\s*\/\s*1\.0/i,
    ];

    for (const pattern of patterns) {
      const match = feedback.match(pattern);
      if (match) {
        const score = parseFloat(match[1]);
        if (score >= 0.0 && score <= 1.0) {
          return score;
        }
      }
    }

    // Fallback qualitative assessment
    const feedbackLower = feedback.toLowerCase();
    if (
      feedbackLower.includes("excellent") ||
      feedbackLower.includes("perfect")
    )
      return 0.95;
    if (feedbackLower.includes("good") || feedbackLower.includes("correct"))
      return 0.8;
    if (
      feedbackLower.includes("satisfactory") ||
      feedbackLower.includes("okay")
    )
      return 0.6;
    if (feedbackLower.includes("needs improvement")) return 0.4;
    if (feedbackLower.includes("incorrect") || feedbackLower.includes("wrong"))
      return 0.2;

    return 0.5; // Default fallback
  }

  async getAdaptiveHint(
    topic,
    currentMastery,
    questionContext,
    attemptNumber = 1
  ) {
    try {
      const hintLevels = {
        1: "conceptual",
        2: "strategic",
        3: "tactical",
        4: "detailed",
      };

      const hintLevel = hintLevels[Math.min(attemptNumber, 4)] || "conceptual";

      const prompt = `You are providing a ${hintLevel} hint for a student struggling with ${topic}.

STUDENT CONTEXT:
- Current mastery: ${currentMastery.toFixed(2)}/1.0
- Attempt number: ${attemptNumber}
- Question context: ${questionContext}

HINT LEVEL GUIDELINES:
- conceptual: Explain the core concept without giving away the solution
- strategic: Suggest the general approach or algorithm to use
- tactical: Provide specific implementation tips or common patterns
- detailed: Give step-by-step guidance while letting student implement

Keep the hint encouraging and educational. Don't solve the problem for them.
Maximum 150 words.`;

      const hint = await this.generateWithOllama(this.llmModel, prompt);

      return {
        hint,
        hintLevel,
        attemptNumber,
      };
    } catch (error) {
      throw new Error(`Hint generation failed: ${error.message}`);
    }
  }

  calculateMasteryUpdate(currentMastery, score, difficulty) {
    // Learning rate based on current mastery
    let learningRate;
    if (currentMastery < 0.3) learningRate = 0.8;
    else if (currentMastery < 0.6) learningRate = 0.6;
    else learningRate = 0.4;

    // Base increment calculation
    let baseIncrement;
    if (score >= 0.9) baseIncrement = 0.15;
    else if (score >= 0.7) baseIncrement = 0.1;
    else if (score >= 0.5) baseIncrement = 0.05;
    else if (score >= 0.3) baseIncrement = 0.0;
    else baseIncrement = -0.08;

    // Difficulty multiplier
    const difficultyMultipliers = { easy: 0.7, medium: 1.0, hard: 1.4 };
    const difficultyMult = difficultyMultipliers[difficulty] || 1.0;

    // Calculate final increment
    const increment = baseIncrement * learningRate * difficultyMult;

    // Apply bounds
    return Math.max(0.0, Math.min(1.0, currentMastery + increment));
  }

  async startSession(userId) {
    try {
      // Initialize session with default knowledge states
      const sessionData = {
        userId,
        knowledgeStates: Object.entries(this.defaultKnowledge).map(
          ([topic, mastery]) => ({
            topic,
            mastery,
            streak: 0,
            lastPracticed: null,
          })
        ),
        questionHistory: [],
        sessionStats: {},
        startTime: new Date().toISOString(),
      };

      return sessionData;
    } catch (error) {
      throw new Error(`Session initialization failed: ${error.message}`);
    }
  }

  async getLearningAnalytics(sessionData) {
    try {
      const { knowledgeStates, questionHistory } = sessionData;

      // Convert to maps for easier processing
      const knowledgeMap = {};
      knowledgeStates.forEach((ks) => {
        knowledgeMap[ks.topic] = ks.mastery;
      });

      // Group questions by topic
      const questionsByTopic = {};
      questionHistory.forEach((q) => {
        if (!questionsByTopic[q.topic]) {
          questionsByTopic[q.topic] = [];
        }
        questionsByTopic[q.topic].push(q);
      });

      // Calculate analytics
      const totalQuestions = questionHistory.length;
      const correctAnswers = questionHistory.filter(
        (q) => q.score >= 0.7
      ).length;
      const accuracy =
        totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0;

      // Mastery distribution
      const masteryLevels = {
        mastered: [],
        proficient: [],
        developing: [],
        beginning: [],
      };

      Object.entries(knowledgeMap).forEach(([topic, mastery]) => {
        if (mastery >= 0.8) masteryLevels.mastered.push(topic);
        else if (mastery >= 0.6) masteryLevels.proficient.push(topic);
        else if (mastery >= 0.3) masteryLevels.developing.push(topic);
        else masteryLevels.beginning.push(topic);
      });

      // Topic performance
      const topicPerformance = {};
      Object.entries(questionsByTopic).forEach(([topic, questions]) => {
        const topicCorrect = questions.filter((q) => q.score >= 0.7).length;
        const avgScore =
          questions.reduce((sum, q) => sum + q.score, 0) / questions.length;

        topicPerformance[topic] = {
          questionsAnswered: questions.length,
          accuracy: (topicCorrect / questions.length) * 100,
          averageScore: avgScore,
          currentMastery: knowledgeMap[topic],
        };
      });

      // Learning recommendations
      const recommendations = this.generateLearningRecommendations(
        knowledgeMap,
        questionsByTopic
      );

      return {
        sessionOverview: {
          totalQuestions,
          accuracy: Math.round(accuracy),
          topicsAttempted: Object.keys(questionsByTopic).length,
          avgMastery:
            Object.values(knowledgeMap).reduce((sum, m) => sum + m, 0) /
            Object.keys(knowledgeMap).length,
        },
        masteryLevels,
        topicPerformance,
        recommendations,
        knowledgeState: knowledgeMap,
      };
    } catch (error) {
      throw new Error(`Analytics generation failed: ${error.message}`);
    }
  }

  generateLearningRecommendations(knowledgeState, questionsByTopic) {
    const recommendations = [];

    // Find struggling topics
    Object.entries(knowledgeState).forEach(([topic, mastery]) => {
      const topicQuestions = questionsByTopic[topic] || [];

      if (mastery < 0.4 && topicQuestions.length >= 2) {
        recommendations.push({
          topic,
          reason: `Low mastery (${mastery.toFixed(2)}) - needs more practice`,
          priority: mastery < 0.3 ? "high" : "medium",
          type: "practice",
        });
      }
    });

    // Find topics ready for advancement
    Object.entries(knowledgeState).forEach(([topic, mastery]) => {
      if (mastery >= 0.7) {
        const { canProceed } = this.checkPrerequisites(topic, knowledgeState);
        if (canProceed) {
          recommendations.push({
            topic,
            reason: `Strong mastery (${mastery.toFixed(
              2
            )}) - ready for advanced challenges`,
            priority: "medium",
            type: "advance",
          });
        }
      }
    });

    // Limit to top 5 recommendations
    return recommendations
      .sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      })
      .slice(0, 5);
  }

  getNextRecommendedTopic(knowledgeState, sessionHistory = {}) {
    return this.selectNextTopic(knowledgeState, sessionHistory);
  }
}

module.exports = new OllamaService();
