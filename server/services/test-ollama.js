// test-ollama.js
const OllamaService = require("./ollama"); // Adjust path as needed

async function testOllamaService() {
  console.log("🧪 Testing Ollama Service...\n");

  try {
    // Test 1: Check health
    console.log("1️⃣ Testing Ollama health...");
    const health = await OllamaService.checkOllamaHealth();
    console.log("Health status:", health);
    console.log("");

    // Test 2: Test direct generation
    console.log("2️⃣ Testing direct Ollama generation...");
    const simpleResponse = await OllamaService.generateWithOllama(
      "llama3.2",
      "Say hello in one sentence.",
      { temperature: 0.1 }
    );
    console.log("Simple response:", simpleResponse);
    console.log("");

    // Test 3: Test question generation
    console.log("3️⃣ Testing question generation...");
    const questionResult = await OllamaService.generateQuestion(
      "Arrays",
      0.3,
      "coding problem",
      {}
    );
    console.log("Question result:", {
      topic: questionResult.topic,
      difficulty: questionResult.difficulty,
      questionId: questionResult.questionId,
      questionLength: questionResult.question.length,
      questionPreview: questionResult.question.substring(0, 300) + "...",
    });
    console.log("");

    // Test 4: Start a session
    console.log("4️⃣ Testing session start...");
    const sessionData = await OllamaService.startSession("test-user-123");
    console.log("Session data:", {
      userId: sessionData.userId,
      knowledgeStatesCount: sessionData.knowledgeStates.length,
      startTime: sessionData.startTime,
    });

    console.log("✅ All tests passed!");
  } catch (error) {
    console.error("❌ Test failed:", error.message);
    console.error("Full error:", error);
  }
}

// Run the test
testOllamaService();
