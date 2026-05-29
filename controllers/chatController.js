const { GoogleGenerativeAI } = require("@google/generative-ai");
const pool = require("../db");

const genAI = new GoogleGenerativeAI(
  process.env.GEMINI_API_KEY
);

const chatWithGemini = async (req, res) => {
  try {
    const { message, student_id } = req.body;

    // ================= VALIDATION =================
    if (!message || message.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Message is required"
      });
    }

    // ================= MODEL =================
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash"
    });

    // ================= PROMPT =================
    const prompt = `
You are a safe and friendly AI chatbot for school students.

Rules:
- Reply in simple Hindi + English.
- Help in studies, coding, maths, science and english.
- Never answer adult or harmful questions.
- Keep answers short and clear.

Student Question:
${message}
`;

    // ================= GEMINI RESPONSE =================
    const result = await model.generateContent(prompt);

    const reply =
      result.response.text() || "No response generated";

    // ================= SAVE CHAT (OPTIONAL) =================
    if (student_id) {
      await pool.query(
        `
        INSERT INTO chat_messages
        (student_id, user_message, bot_reply)
        VALUES ($1, $2, $3)
        `,
        [student_id, message, reply]
      );
    }

    // ================= FINAL RESPONSE =================
    res.status(200).json({
      success: true,
      user_message: message,
      reply
    });

  } catch (error) {
    console.error("Gemini Error:", error);

    res.status(500).json({
      success: false,
      message: "AI Server Error",
      error: error.message
    });
  }
};

module.exports = {
  chatWithGemini
};