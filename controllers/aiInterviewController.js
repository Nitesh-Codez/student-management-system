
const db = require("../db");
const genAI = require("../config/gemini");

// ==================== CONSTANTS ====================

const ALLOWED_LEVELS = ["Beginner", "Intermediate", "Advanced"];

const ALLOWED_INTERVIEW_TYPES = [
    "General English",
    "Academic Interview",
    "Job Interview"
];

const ALLOWED_QUESTION_COUNTS = [5, 10];

const SCORE_KEYS = [
    "grammarScore",
    "fluencyScore",
    "vocabularyScore",
    "relevanceScore"
];

// ==================== GEMINI HELPERS ====================

const extractJsonObject = (text) => {
    if (typeof text !== "string") {
        throw new Error("Gemini response is not a string");
    }

    const cleaned = text
        .replace(/```json/gi, "")
        .replace(/```/g, "")
        .trim();

    const startIdx = cleaned.indexOf("{");
    const endIdx = cleaned.lastIndexOf("}");

    if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
        throw new Error("Invalid JSON response from Gemini");
    }

    return JSON.parse(cleaned.slice(startIdx, endIdx + 1));
};

// ==================== GENERATE QUESTION ====================

const generateAIQuestion = async (
    level,
    interviewType,
    questionNumber,
    previousAnswers = []
) => {
    const prompt = `
You are a friendly English communication interviewer.

Student Level: ${level}
Interview Type: ${interviewType}
Question Number: ${questionNumber}

Previous conversation:
${JSON.stringify(previousAnswers)}

Generate exactly ONE English interview question.

Rules:
- Use simple English for beginners.
- Adapt difficulty to the selected level.
- Avoid repeating previous questions.
- Keep questions relevant to the interview type.
- Return only the question text without markdown or numbering.
`.trim();

    const response = await genAI.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt
    });

    const question = typeof response?.text === "string"
        ? response.text.replace(/^["']|["']$/g, "").trim()
        : "";

    if (!question) {
        throw new Error("Gemini returned an empty question");
    }

    return question;
};

// ==================== EVALUATE ANSWER ====================

const evaluateAIAnswer = async (question, answer) => {
    const prompt = `
You are a professional English communication teacher.

Evaluate the student's answer.

Question: ${question}
Answer: ${answer}

Return valid JSON only in this exact structure:

{
    "grammarScore": 0,
    "fluencyScore": 0,
    "vocabularyScore": 0,
    "relevanceScore": 0,
    "feedback": "Simple feedback",
    "mistakes": ["mistake"],
    "improvedAnswer": "Corrected answer"
}

Rules:
- All scores must be numbers between 0 and 100.
- mistakes must be an array of strings.
- Use [] if there are no mistakes.
- Evaluate the transcript, not accent.
- Do not assume speaking speed from text.
- Be encouraging and constructive.
`.trim();

    const response = await genAI.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt
    });

    const evaluation = extractJsonObject(response?.text);

    for (const key of SCORE_KEYS) {
        const value = evaluation[key];

        if (
            typeof value !== "number" ||
            !Number.isFinite(value) ||
            value < 0 ||
            value > 100
        ) {
            throw new Error(`Invalid score for ${key}`);
        }

        evaluation[key] = Math.round(value * 100) / 100;
    }

    if (
        typeof evaluation.feedback !== "string" ||
        !evaluation.feedback.trim()
    ) {
        throw new Error("Invalid feedback");
    }

    if (
        !Array.isArray(evaluation.mistakes) ||
        !evaluation.mistakes.every(
            item => typeof item === "string"
        )
    ) {
        throw new Error("Invalid mistakes array");
    }

    if (
        typeof evaluation.improvedAnswer !== "string" ||
        !evaluation.improvedAnswer.trim()
    ) {
        throw new Error("Invalid improved answer");
    }

    return {
        grammarScore: evaluation.grammarScore,
        fluencyScore: evaluation.fluencyScore,
        vocabularyScore: evaluation.vocabularyScore,
        relevanceScore: evaluation.relevanceScore,
        feedback: evaluation.feedback.trim(),
        mistakes: evaluation.mistakes.map(
            item => item.trim()
        ).filter(Boolean),
        improvedAnswer: evaluation.improvedAnswer.trim()
    };
};

// ==================== 1. START INTERVIEW ====================

exports.startInterview = async (req, res) => {
    let client;

    try {
        const studentId = req.user?.id;

        if (!studentId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized"
            });
        }

        const { level, interviewType } = req.body ?? {};

        const totalQuestions = Number(
            req.body?.totalQuestions ?? 5
        );

        if (
            !ALLOWED_LEVELS.includes(level) ||
            !ALLOWED_INTERVIEW_TYPES.includes(interviewType) ||
            !ALLOWED_QUESTION_COUNTS.includes(totalQuestions)
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid interview settings"
            });
        }

        client = await db.connect();

        await client.query("BEGIN");

        const inserted = await client.query(
            `INSERT INTO ai_interviews
             (student_id, level, interview_type, total_questions, status)
             VALUES ($1, $2, $3, $4, 'In Progress')
             RETURNING *`,
            [studentId, level, interviewType, totalQuestions]
        );

        const interview = inserted.rows[0];

        const question = await generateAIQuestion(
            level,
            interviewType,
            1,
            []
        );

        await client.query(
            `UPDATE ai_interviews
             SET pending_question = $1,
                 pending_question_number = 1
             WHERE id = $2
             AND student_id = $3`,
            [question, interview.id, studentId]
        );

        await client.query("COMMIT");

        return res.status(201).json({
            success: true,
            interviewId: interview.id,
            questionNumber: 1,
            question
        });

    } catch (error) {
        if (client) {
            await client.query("ROLLBACK").catch(() => {});
        }

        console.error("Start Interview Error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to start interview"
        });

    } finally {
        client?.release();
    }
};

// ==================== 2. EVALUATE ANSWER ====================

exports.evaluateAnswer = async (req, res) => {
    let client;

    try {
        const studentId = req.user?.id;

        if (!studentId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized"
            });
        }

        const { interviewId, question, answer } = req.body ?? {};

        if (
            !interviewId ||
            typeof question !== "string" ||
            typeof answer !== "string" ||
            !question.trim() ||
            !answer.trim()
        ) {
            return res.status(400).json({
                success: false,
                message: "Interview ID, question and answer are required"
            });
        }

        client = await db.connect();

        await client.query("BEGIN");

        const interviewResult = await client.query(
            `SELECT *
             FROM ai_interviews
             WHERE id = $1
             AND student_id = $2
             AND status = 'In Progress'
             FOR UPDATE`,
            [interviewId, studentId]
        );

        if (!interviewResult.rows.length) {
            await client.query("ROLLBACK");

            return res.status(404).json({
                success: false,
                message: "Active interview not found"
            });
        }

        const interview = interviewResult.rows[0];

        if (
            !interview.pending_question ||
            question.trim() !== interview.pending_question.trim()
        ) {
            await client.query("ROLLBACK");

            return res.status(400).json({
                success: false,
                message: "Invalid or outdated interview question"
            });
        }

        const questionNumber = Number(
            interview.pending_question_number
        );

        const totalQuestions = Number(
            interview.total_questions
        );

        if (
            !Number.isInteger(questionNumber) ||
            questionNumber < 1 ||
            questionNumber > totalQuestions
        ) {
            await client.query("ROLLBACK");

            return res.status(400).json({
                success: false,
                message: "Invalid question number"
            });
        }

        const evaluation = await evaluateAIAnswer(
            interview.pending_question.trim(),
            answer.trim()
        );

        const saved = await client.query(
            `INSERT INTO ai_interview_answers
             (
                 interview_id,
                 question_number,
                 question,
                 answer_text,
                 grammar_score,
                 fluency_score,
                 vocabulary_score,
                 relevance_score,
                 feedback,
                 mistakes,
                 improved_answer
             )
             VALUES (
                 $1, $2, $3, $4, $5,
                 $6, $7, $8, $9, $10::jsonb, $11
             )
             RETURNING *`,
            [
                interviewId,
                questionNumber,
                interview.pending_question.trim(),
                answer.trim(),
                evaluation.grammarScore,
                evaluation.fluencyScore,
                evaluation.vocabularyScore,
                evaluation.relevanceScore,
                evaluation.feedback,
                JSON.stringify(evaluation.mistakes),
                evaluation.improvedAnswer
            ]
        );

        await client.query(
            `UPDATE ai_interviews
             SET pending_question = NULL,
                 pending_question_number = NULL
             WHERE id = $1
             AND student_id = $2`,
            [interviewId, studentId]
        );

        await client.query("COMMIT");

        return res.json({
            success: true,
            questionNumber,
            evaluation,
            savedAnswer: saved.rows[0]
        });

    } catch (error) {
        if (client) {
            await client.query("ROLLBACK").catch(() => {});
        }

        console.error("Evaluate Answer Error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to evaluate answer"
        });

    } finally {
        client?.release();
    }
};

// ==================== 3. GET NEXT QUESTION ====================

exports.getNextQuestion = async (req, res) => {
    let client;

    try {
        const studentId = req.user?.id;

        if (!studentId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized"
            });
        }

        const { interviewId } = req.params;

        if (!interviewId) {
            return res.status(400).json({
                success: false,
                message: "Interview ID is required"
            });
        }

        client = await db.connect();

        await client.query("BEGIN");

        const result = await client.query(
            `SELECT *
             FROM ai_interviews
             WHERE id = $1
             AND student_id = $2
             AND status = 'In Progress'
             FOR UPDATE`,
            [interviewId, studentId]
        );

        if (!result.rows.length) {
            await client.query("ROLLBACK");

            return res.status(404).json({
                success: false,
                message: "Active interview not found"
            });
        }

        const interview = result.rows[0];

        if (interview.pending_question) {
            await client.query("COMMIT");

            return res.json({
                success: true,
                completed: false,
                questionNumber: Number(
                    interview.pending_question_number
                ),
                question: interview.pending_question
            });
        }

        const answers = await client.query(
            `SELECT question_number, question, answer_text
             FROM ai_interview_answers
             WHERE interview_id = $1
             ORDER BY question_number ASC`,
            [interviewId]
        );

        const nextNumber = answers.rows.length + 1;

        if (nextNumber > Number(interview.total_questions)) {
            await client.query("COMMIT");

            return res.json({
                success: true,
                completed: true,
                message: "All questions answered"
            });
        }

        const question = await generateAIQuestion(
            interview.level,
            interview.interview_type,
            nextNumber,
            answers.rows
        );

        await client.query(
            `UPDATE ai_interviews
             SET pending_question = $1,
                 pending_question_number = $2
             WHERE id = $3
             AND student_id = $4
             AND status = 'In Progress'`,
            [question, nextNumber, interviewId, studentId]
        );

        await client.query("COMMIT");

        return res.json({
            success: true,
            completed: false,
            questionNumber: nextNumber,
            question
        });

    } catch (error) {
        if (client) {
            await client.query("ROLLBACK").catch(() => {});
        }

        console.error("Next Question Error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to generate next question"
        });

    } finally {
        client?.release();
    }
};

// ==================== 4. COMPLETE INTERVIEW ====================

exports.completeInterview = async (req, res) => {
    let client;

    try {
        const studentId = req.user?.id;

        if (!studentId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized"
            });
        }

        const { interviewId } = req.body ?? {};

        if (!interviewId) {
            return res.status(400).json({
                success: false,
                message: "Interview ID is required"
            });
        }

        client = await db.connect();

        await client.query("BEGIN");

        const result = await client.query(
            `SELECT *
             FROM ai_interviews
             WHERE id = $1
             AND student_id = $2
             AND status = 'In Progress'
             FOR UPDATE`,
            [interviewId, studentId]
        );

        if (!result.rows.length) {
            await client.query("ROLLBACK");

            return res.status(404).json({
                success: false,
                message: "Active interview not found"
            });
        }

        const interview = result.rows[0];

        if (interview.pending_question) {
            await client.query("ROLLBACK");

            return res.status(400).json({
                success: false,
                message: "Current question must be answered first"
            });
        }

        const scores = await client.query(
            `SELECT
                 COALESCE(
                     ROUND(
                         AVG(
                             (grammar_score + fluency_score +
                              vocabulary_score + relevance_score) / 4.0
                         )::numeric,
                         2
                     ),
                     0
                 ) AS overall_score,
                 COUNT(*)::int AS answered
             FROM ai_interview_answers
             WHERE interview_id = $1`,
            [interviewId]
        );

        const data = scores.rows[0];

        const answeredCount = Number(data.answered);

        if (answeredCount !== Number(interview.total_questions)) {
            await client.query("ROLLBACK");

            return res.status(400).json({
                success: false,
                message: "All questions must be answered first"
            });
        }

        const overallScore = Number(data.overall_score);

        const updated = await client.query(
            `UPDATE ai_interviews
             SET status = 'Completed',
                 overall_score = $1,
                 completed_at = NOW(),
                 pending_question = NULL,
                 pending_question_number = NULL
             WHERE id = $2
             AND student_id = $3
             AND status = 'In Progress'
             RETURNING *`,
            [overallScore, interviewId, studentId]
        );

        await client.query("COMMIT");

        return res.json({
            success: true,
            message: "Interview completed successfully",
            report: updated.rows[0]
        });

    } catch (error) {
        if (client) {
            await client.query("ROLLBACK").catch(() => {});
        }

        console.error("Complete Interview Error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to complete interview"
        });

    } finally {
        client?.release();
    }
};

// ==================== 5. GET INTERVIEW HISTORY ====================

exports.getInterviewHistory = async (req, res) => {
    try {
        const studentId = req.user?.id;

        if (!studentId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized"
            });
        }

        const result = await db.query(
            `SELECT *
             FROM ai_interviews
             WHERE student_id = $1
             ORDER BY started_at DESC`,
            [studentId]
        );

        return res.json({
            success: true,
            interviews: result.rows
        });

    } catch (error) {
        console.error("Interview History Error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to fetch interview history"
        });
    }
};

// ==================== 6. GET INTERVIEW REPORT ====================

exports.getInterviewReport = async (req, res) => {
    try {
        const studentId = req.user?.id;

        if (!studentId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized"
            });
        }

        const { interviewId } = req.params;

        if (!interviewId) {
            return res.status(400).json({
                success: false,
                message: "Interview ID is required"
            });
        }

        const interview = await db.query(
            `SELECT *
             FROM ai_interviews
             WHERE id = $1
             AND student_id = $2`,
            [interviewId, studentId]
        );

        if (!interview.rows.length) {
            return res.status(404).json({
                success: false,
                message: "Interview not found"
            });
        }

        const answers = await db.query(
            `SELECT *
             FROM ai_interview_answers
             WHERE interview_id = $1
             ORDER BY question_number ASC`,
            [interviewId]
        );

        return res.json({
            success: true,
            interview: interview.rows[0],
            answers: answers.rows
        });

    } catch (error) {
        console.error("Interview Report Error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to fetch report"
        });
    }
};
