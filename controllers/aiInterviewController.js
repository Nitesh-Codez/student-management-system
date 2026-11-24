const db = require("../db");
const genAI = require("../config/gemini");

// ==================== GEMINI QUESTION HELPER ====================

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
- Return only the question.
`;

    const response = await genAI.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt
    });

    const question = response.text?.trim();

    if (!question) {
        throw new Error("Gemini returned an empty question");
    }

    return question;
};


// ==================== GEMINI EVALUATION HELPER ====================

const evaluateAIAnswer = async (question, answer) => {
    const prompt = `
You are a professional English communication teacher.

Evaluate the student's answer.

Question: ${question}
Answer: ${answer}

Return valid JSON only:
{
  "grammarScore": 0,
  "fluencyScore": 0,
  "vocabularyScore": 0,
  "relevanceScore": 0,
  "feedback": "Simple feedback",
  "mistakes": ["mistake"],
  "improvedAnswer": "Corrected answer"
}

All scores must be between 0 and 100.

Evaluate the transcript, not accent.
Do not assume speaking speed from text.
Be encouraging and constructive.
`;

    const response = await genAI.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt
    });

    const raw = response.text
        ?.replace(/```json/gi, "")
        .replace(/```/g, "")
        .trim();

    if (!raw) {
        throw new Error("Gemini returned empty evaluation");
    }

    const evaluation = JSON.parse(raw);

    const scoreKeys = [
        "grammarScore",
        "fluencyScore",
        "vocabularyScore",
        "relevanceScore"
    ];

    for (const key of scoreKeys) {
        if (
            typeof evaluation[key] !== "number" ||
            !Number.isFinite(evaluation[key]) ||
            evaluation[key] < 0 ||
            evaluation[key] > 100
        ) {
            throw new Error(`Invalid ${key}`);
        }
    }

    if (
        typeof evaluation.feedback !== "string" ||
        !Array.isArray(evaluation.mistakes) ||
        typeof evaluation.improvedAnswer !== "string"
    ) {
        throw new Error("Invalid evaluation response");
    }

    return evaluation;
};


// ==================== 1. START INTERVIEW ====================

exports.startInterview = async (req, res) => {
    try {
        const { level, interviewType } = req.body;
        const totalQuestions = Number(req.body.totalQuestions ?? 5);
        const studentId = req.user.id;

        if (
            !["Beginner", "Intermediate", "Advanced"].includes(level) ||
            !["General English", "Academic Interview", "Job Interview"].includes(interviewType) ||
            ![5, 10].includes(totalQuestions)
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid interview settings"
            });
        }

        const result = await db.query(
            `INSERT INTO ai_interviews
             (student_id, level, interview_type, total_questions, status)
             VALUES ($1, $2, $3, $4, 'In Progress')
             RETURNING *`,
            [studentId, level, interviewType, totalQuestions]
        );

        const interview = result.rows[0];
        const question = await generateAIQuestion(level, interviewType, 1);

        await db.query(
            `UPDATE ai_interviews
             SET pending_question = $1,
                 pending_question_number = 1
             WHERE id = $2 AND student_id = $3`,
            [question, interview.id, studentId]
        );

        res.status(201).json({
            success: true,
            interviewId: interview.id,
            questionNumber: 1,
            question
        });
    } catch (error) {
        console.error("Start Interview Error:", error);
        res.status(500).json({
            success: false,
            message: "Unable to start interview"
        });
    }
};


// ==================== 2. EVALUATE ANSWER ====================

exports.evaluateAnswer = async (req, res) => {
    try {
        const { interviewId, question, answer } = req.body;

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

        const interviewResult = await db.query(
            `SELECT * FROM ai_interviews
             WHERE id = $1
             AND student_id = $2
             AND status = 'In Progress'`,
            [interviewId, req.user.id]
        );

        if (!interviewResult.rows.length) {
            return res.status(404).json({
                success: false,
                message: "Interview not found"
            });
        }

        const interview = interviewResult.rows[0];

        if (
            !interview.pending_question ||
            question.trim() !== interview.pending_question.trim()
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid or outdated interview question"
            });
        }

        const questionNumber = interview.pending_question_number;

        if (!questionNumber || questionNumber > interview.total_questions) {
            return res.status(400).json({
                success: false,
                message: "Invalid question number"
            });
        }

        const evaluation = await evaluateAIAnswer(question, answer);

        const saved = await db.query(
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
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
             RETURNING *`,
            [
                interviewId,
                questionNumber,
                question,
                answer,
                evaluation.grammarScore,
                evaluation.fluencyScore,
                evaluation.vocabularyScore,
                evaluation.relevanceScore,
                evaluation.feedback,
                JSON.stringify(evaluation.mistakes),
                evaluation.improvedAnswer
            ]
        );

        await db.query(
            `UPDATE ai_interviews
             SET pending_question = NULL,
                 pending_question_number = NULL
             WHERE id = $1 AND student_id = $2`,
            [interviewId, req.user.id]
        );

        res.json({
            success: true,
            questionNumber,
            evaluation,
            savedAnswer: saved.rows[0]
        });
    } catch (error) {
        console.error("Evaluate Answer Error:", error);
        res.status(500).json({
            success: false,
            message: "Unable to evaluate answer"
        });
    }
};


// ==================== 3. GET NEXT QUESTION ====================

exports.getNextQuestion = async (req, res) => {
    try {
        const { interviewId } = req.params;

        const result = await db.query(
            `SELECT * FROM ai_interviews
             WHERE id = $1
             AND student_id = $2
             AND status = 'In Progress'`,
            [interviewId, req.user.id]
        );

        if (!result.rows.length) {
            return res.status(404).json({
                success: false,
                message: "Interview not found"
            });
        }

        const interview = result.rows[0];

        if (interview.pending_question) {
            return res.json({
                success: true,
                completed: false,
                questionNumber: interview.pending_question_number,
                question: interview.pending_question
            });
        }

        const answers = await db.query(
            `SELECT question_number, question, answer_text
             FROM ai_interview_answers
             WHERE interview_id = $1
             ORDER BY question_number`,
            [interviewId]
        );

        const nextNumber = answers.rows.length + 1;

        if (nextNumber > interview.total_questions) {
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

        await db.query(
            `UPDATE ai_interviews
             SET pending_question = $1,
                 pending_question_number = $2
             WHERE id = $3
             AND student_id = $4
             AND status = 'In Progress'`,
            [question, nextNumber, interviewId, req.user.id]
        );

        res.json({
            success: true,
            completed: false,
            questionNumber: nextNumber,
            question
        });
    } catch (error) {
        console.error("Next Question Error:", error);
        res.status(500).json({
            success: false,
            message: "Unable to generate next question"
        });
    }
};


// ==================== 4. COMPLETE INTERVIEW ====================

exports.completeInterview = async (req, res) => {
    try {
        const { interviewId } = req.body;

        if (!interviewId) {
            return res.status(400).json({
                success: false,
                message: "Interview ID is required"
            });
        }

        const result = await db.query(
            `SELECT * FROM ai_interviews
             WHERE id = $1
             AND student_id = $2
             AND status = 'In Progress'`,
            [interviewId, req.user.id]
        );

        if (!result.rows.length) {
            return res.status(404).json({
                success: false,
                message: "Interview not found"
            });
        }

        const interview = result.rows[0];

        if (interview.pending_question) {
            return res.status(400).json({
                success: false,
                message: "Current question must be answered first"
            });
        }

        const scores = await db.query(
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

        if (data.answered !== interview.total_questions) {
            return res.status(400).json({
                success: false,
                message: "All questions must be answered first"
            });
        }

        const updated = await db.query(
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
            [Number(data.overall_score), interviewId, req.user.id]
        );

        res.json({
            success: true,
            message: "Interview completed successfully",
            report: updated.rows[0]
        });
    } catch (error) {
        console.error("Complete Interview Error:", error);
        res.status(500).json({
            success: false,
            message: "Unable to complete interview"
        });
    }
};


// ==================== 5. GET INTERVIEW HISTORY ====================

exports.getInterviewHistory = async (req, res) => {
    try {
        const result = await db.query(
            `SELECT * FROM ai_interviews
             WHERE student_id = $1
             ORDER BY started_at DESC`,
            [req.user.id]
        );

        res.json({
            success: true,
            interviews: result.rows
        });
    } catch (error) {
        console.error("Interview History Error:", error);
        res.status(500).json({
            success: false,
            message: "Unable to fetch interview history"
        });
    }
};


// ==================== 6. GET INTERVIEW REPORT ====================

exports.getInterviewReport = async (req, res) => {
    try {
        const { interviewId } = req.params;

        const interview = await db.query(
            `SELECT * FROM ai_interviews
             WHERE id = $1
             AND student_id = $2`,
            [interviewId, req.user.id]
        );

        if (!interview.rows.length) {
            return res.status(404).json({
                success: false,
                message: "Interview not found"
            });
        }

        const answers = await db.query(
            `SELECT * FROM ai_interview_answers
             WHERE interview_id = $1
             ORDER BY question_number`,
            [interviewId]
        );

        res.json({
            success: true,
            interview: interview.rows[0],
            answers: answers.rows
        });
    } catch (error) {
        console.error("Interview Report Error:", error);
        res.status(500).json({
            success: false,
            message: "Unable to fetch report"
        });
    }
};