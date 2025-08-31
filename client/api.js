// api.js
const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5001/api";

export const startSession = async (userId) => {
  const response = await fetch(`${API_URL}/assessment/start`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ userId }),
  });
  return await response.json();
};

export const getQuestion = async (userId, topic, Mastery) => {
  const response = await fetch(`${API_URL}/assessment/question`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ userId, topic, Mastery }),
  });
  return await response.json();
};

export const evaluateAnswer = async (
  userId,
  question,
  answer,
  topic,
  language
) => {
  const response = await fetch(`${API_URL}/assessment/evaluate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ userId, question, answer, topic, language }),
  });
  return await response.json();
};
