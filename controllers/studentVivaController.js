
const db = require("../db");
const genAI = require("../config/gemini");

const MODEL_NAME =
    process.env.GEMINI_MODEL || "gemini-3.8-flash";

const MAX_SCORE = 10;


// ======================================================
// COMMON HELPERS
// ======================================================

const getStudentId = (req) => {
    return req.user?.id || null;
};


// IMPORTANT:
// Change this query if your actual student table or
// class column has a different name.

const getStudentClass = async (studentId) => {
    const result = await db.query(
        `SELECT class_name
         FROM students
         WHERE id = $1`,
        [studentId]
    );

    return result.rows[0]?.class_name || null;
};


const generateContent = async (prompt) => {
    if (!genAI?.models?.generateContent) {
        throw new Error("Gemini SDK is not configured");
    }

    const response = await genAI.models.generateContent({
        model: MODEL_NAME,
        contents: prompt
    });

    if (!response?.text) {
        throw new Error("Empty Gemini response");
    }

    return response.text.trim();
};


const extractJSON = (text) => {
    const cleaned = text
        .replace(/```json/gi, "")
        .replace(/```/g, "")
        .trim();

    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");

    if (start === -1 || end <= start) {
        throw new Error("Invalid Gemini JSON response");
    }

    return JSON.parse(cleaned.slice(start, end + 1));
};


const generateQuestion = async (
    viva,
    topics,
    previousQuestions = []
) => {
    const prompt = `
You are an experienced school teacher conducting an oral viva.

Class: ${viva.class_name}
Subject: ${viva.subject}
Difficulty: ${viva.difficulty}

Allowed Topics:
${topics.join(", ")}

Previously Asked Questions:
${JSON.stringify(previousQuestions)}

Instructions:
1. Generate exactly ONE question.
2. Question must belong to the given subject and allowed topics.
3. Follow the specified class level.
4. Do not repeat previous questions.
5. Keep the question clear and educational.
6. Match the specified difficulty.
7. Do not include answers or explanations.

Return valid JSON only:
{
    "topic": "topic name",
    "question": "question text"
}
`;

    const raw = await generateContent(prompt);
    const data = extractJSON(raw);

    if (
        typeof data.question !== "string" ||
        !data.question.trim() ||
        data.question.length > 1000 ||
        typeof data.topic !== "string" ||
        !topics.some(
            t => t.toLowerCase() === data.topic.trim().toLowerCase()
        )
    ) {
        throw new Error("Invalid generated viva question");
    }

    return {
        question: data.question.trim(),
        topic: topics.find(
            t => t.toLowerCase() === data.topic.trim().toLowerCase()
        )
    };
};


const evaluateAnswer = async (question, answer, viva) => {
    const prompt = `
You are an experienced ${viva.subject} teacher.

Class: ${viva.class_name}
Subject: ${viva.subject}

Question:
${question}

Student Answer:
${answer}

Evaluate the answer according to factual correctness
and understanding appropriate for this class.

Maximum Marks: 10

Return valid JSON only:
{
    "score": 0,
    "feedback": "Simple constructive feedback",
    "isCorrect": false
}

Rules:
1. Score must be between 0 and 10.
2. Give partial marks for partially correct answers.
3. Do not award marks for unrelated answers.
4. Be fair to short but correct answers.
5. Do not penalize spelling unless it changes meaning.
6. Do not assume facts that are not in the answer.
`;

    const raw = await generateContent(prompt);
    const data = extractJSON(raw);

    const score = Number(data.score);

    if (
        !Number.isFinite(score) ||
        score < 0 ||
        score > MAX_SCORE ||
        typeof data.feedback !== "string" ||
        typeof data.isCorrect !== "boolean"
    ) {
        throw new Error("Invalid AI evaluation");
    }

    return {
        score: Math.round(score * 100) / 100,
        feedback: data.feedback.trim(),
        isCorrect: data.isCorrect
    };
};


// ======================================================
// 1. GET AVAILABLE VIVAS
// ======================================================

exports.getAvailableVivas = async (req, res) => {
    try {
        const studentId = getStudentId(req);

        if (!studentId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized"
            });
        }

        const className = await getStudentClass(studentId);

        if (!className) {
            return res.status(404).json({
                success: false,
                message: "Student class not found"
            });
        }

        const result = await db.query(
            `SELECT
                v.*,

                COALESCE(
                    ARRAY_AGG(DISTINCT t.topic_name)
                    FILTER (WHERE t.id IS NOT NULL),
                    '{}'
                ) AS topics,

                CASE
                    WHEN CURRENT_DATE < v.start_date
                    THEN 'Upcoming'
                    WHEN CURRENT_DATE > v.end_date
                    THEN 'Expired'
                    ELSE 'Available'
                END AS availability_status

            FROM admin_vivas v

            LEFT JOIN admin_viva_topics t
                ON t.viva_id = v.id

            WHERE
                LOWER(TRIM(v.class_name)) =
                LOWER(TRIM($1))

                AND LOWER(TRIM(v.status)) = 'active'

                AND v.end_date >= CURRENT_DATE

            GROUP BY v.id

            ORDER BY v.start_date ASC`,

            [String(className)]
        );

        return res.status(200).json({
            success: true,
            studentId,
            studentClass: className,
            total: result.rows.length,
            vivas: result.rows
        });

    } catch (error) {
        console.error("Available Vivas Error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to fetch available vivas",
            error: error.message
        });
    }
};


// ======================================================
// 2. START VIVA
// ======================================================

exports.startViva = async (req, res) => {
    const client = await db.connect();

    try {
        const studentId = getStudentId(req);
        const vivaId = req.params.id;

        if (!studentId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized"
            });
        }

        const className = await getStudentClass(studentId);

        if (!className) {
            return res.status(404).json({
                success: false,
                message: "Student class not found"
            });
        }

        await client.query("BEGIN");

        const vivaResult = await client.query(
            `SELECT *
             FROM admin_vivas
             WHERE id = $1
             AND class_name = $2
             AND status = 'Active'
             AND CURRENT_DATE BETWEEN start_date AND end_date
             FOR UPDATE`,
            [vivaId, className]
        );

        if (!vivaResult.rows.length) {
            await client.query("ROLLBACK");

            return res.status(404).json({
                success: false,
                message: "Viva is unavailable or expired"
            });
        }

        const viva = vivaResult.rows[0];

        // Check existing in-progress attempt.
        const existing = await client.query(
            `SELECT *
             FROM student_viva_attempts
             WHERE viva_id = $1
             AND student_id = $2
             AND status = 'In Progress'
             ORDER BY id DESC
             LIMIT 1
             FOR UPDATE`,
            [vivaId, studentId]
        );

        if (existing.rows.length) {
            const attempt = existing.rows[0];

            await client.query("COMMIT");

            return res.json({
                success: true,
                message: "Existing viva resumed",
                attemptId: attempt.id,
                question: attempt.current_question,
                topic: attempt.current_topic,
                questionNumber: attempt.current_question_number,
                totalQuestions: attempt.total_questions
            });
        }

        // Check attempt limit.
        const countResult = await client.query(
            `SELECT COUNT(*)::INTEGER AS attempts
             FROM student_viva_attempts
             WHERE viva_id = $1
             AND student_id = $2`,
            [vivaId, studentId]
        );

        if (
            countResult.rows[0].attempts >= viva.attempt_limit
        ) {
            await client.query("ROLLBACK");

            return res.status(403).json({
                success: false,
                message: "Viva attempt limit reached"
            });
        }

        const topicResult = await client.query(
            `SELECT topic_name
             FROM admin_viva_topics
             WHERE viva_id = $1`,
            [vivaId]
        );

        const topics = topicResult.rows.map(
            row => row.topic_name
        );

        if (!topics.length) {
            throw new Error("No topics configured for viva");
        }

        const generated = await generateQuestion(
            viva,
            topics,
            []
        );

        const attempt = await client.query(
            `INSERT INTO student_viva_attempts
            (
                viva_id,
                student_id,
                total_questions,
                current_question,
                current_topic,
                current_question_number
            )
            VALUES ($1,$2,$3,$4,$5,1)
            RETURNING *`,
            [
                vivaId,
                studentId,
                viva.total_questions,
                generated.question,
                generated.topic
            ]
        );

        await client.query("COMMIT");

        return res.status(201).json({
            success: true,
            message: "Viva started successfully",
            attemptId: attempt.rows[0].id,
            question: generated.question,
            topic: generated.topic,
            questionNumber: 1,
            totalQuestions: viva.total_questions
        });

    } catch (error) {
        await client.query("ROLLBACK");
        console.error("Start Viva:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to start viva"
        });

    } finally {
        client.release();
    }
};


// ======================================================
// 3. SUBMIT ANSWER AND EVALUATE
// ======================================================

exports.submitVivaAnswer = async (req, res) => {
    const client = await db.connect();

    try {
        const studentId = getStudentId(req);
        const { answer } = req.body;
        const { attemptId } = req.params;

        if (
            !studentId ||
            typeof answer !== "string" ||
            !answer.trim() ||
            answer.trim().length > 5000
        ) {
            return res.status(400).json({
                success: false,
                message: "Valid student and answer are required"
            });
        }

        await client.query("BEGIN");

        const result = await client.query(
            `SELECT
                a.*,
                v.subject,
                v.class_name,
                v.difficulty,
                v.end_date
             FROM student_viva_attempts a
             JOIN admin_vivas v ON v.id = a.viva_id
             WHERE a.id = $1
             AND a.student_id = $2
             AND a.status = 'In Progress'
             AND CURRENT_DATE <= v.end_date
             FOR UPDATE OF a`,
            [attemptId, studentId]
        );

        if (!result.rows.length) {
            await client.query("ROLLBACK");

            return res.status(404).json({
                success: false,
                message: "Active viva attempt not found"
            });
        }

        const attempt = result.rows[0];

        if (!attempt.current_question) {
            await client.query("ROLLBACK");

            return res.status(400).json({
                success: false,
                message: "No pending question available"
            });
        }

        const evaluation = await evaluateAnswer(
            attempt.current_question,
            answer.trim(),
            attempt
        );

        const questionNumber =
            Number(attempt.current_question_number);

        const saved = await client.query(
            `INSERT INTO student_viva_answers
            (
                attempt_id,
                question_number,
                topic_name,
                question,
                student_answer,
                score,
                max_score,
                feedback,
                is_correct
            )
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
            RETURNING *`,
            [
                attemptId,
                questionNumber,
                attempt.current_topic,
                attempt.current_question,
                answer.trim(),
                evaluation.score,
                MAX_SCORE,
                evaluation.feedback,
                evaluation.isCorrect
            ]
        );

        await client.query(
            `UPDATE student_viva_attempts
             SET attempted_questions = attempted_questions + 1,
                 total_score = total_score + $1,
                 current_question = NULL,
                 current_topic = NULL,
                 current_question_number = NULL
             WHERE id = $2
             AND student_id = $3`,
            [evaluation.score, attemptId, studentId]
        );

        await client.query("COMMIT");

        return res.json({
            success: true,
            message: "Answer evaluated successfully",
            questionNumber,
            evaluation,
            savedAnswer: saved.rows[0]
        });

    } catch (error) {
        await client.query("ROLLBACK");
        console.error("Submit Viva Answer:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to evaluate answer"
        });

    } finally {
        client.release();
    }
};


// ======================================================
// 4. GENERATE NEXT QUESTION
// ======================================================

exports.getNextQuestion = async (req, res) => {
    const client = await db.connect();

    try {
        const studentId = getStudentId(req);
        const { attemptId } = req.params;

        if (!studentId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized"
            });
        }

        await client.query("BEGIN");

        const result = await client.query(
            `SELECT
                a.*,
                v.subject,
                v.class_name,
                v.difficulty,
                v.end_date
             FROM student_viva_attempts a
             JOIN admin_vivas v ON v.id = a.viva_id
             WHERE a.id = $1
             AND a.student_id = $2
             AND a.status = 'In Progress'
             AND CURRENT_DATE <= v.end_date
             FOR UPDATE OF a`,
            [attemptId, studentId]
        );

        if (!result.rows.length) {
            await client.query("ROLLBACK");

            return res.status(404).json({
                success: false,
                message: "Active attempt not found"
            });
        }

        const attempt = result.rows[0];

        // Return pending question if it already exists.
        if (attempt.current_question) {
            await client.query("COMMIT");

            return res.json({
                success: true,
                completed: false,
                question: attempt.current_question,
                topic: attempt.current_topic,
                questionNumber: attempt.current_question_number,
                totalQuestions: attempt.total_questions
            });
        }

        const answers = await client.query(
            `SELECT question, student_answer
             FROM student_viva_answers
             WHERE attempt_id = $1
             ORDER BY question_number`,
            [attemptId]
        );

        const nextNumber = answers.rows.length + 1;

        if (nextNumber > attempt.total_questions) {
            await client.query("COMMIT");

            return res.json({
                success: true,
                completed: true,
                message: "All questions answered"
            });
        }

        const topicsResult = await client.query(
            `SELECT topic_name
             FROM admin_viva_topics
             WHERE viva_id = $1`,
            [attempt.viva_id]
        );

        const topics = topicsResult.rows.map(
            row => row.topic_name
        );

        const previousQuestions = answers.rows.map(
            row => row.question
        );

        const generated = await generateQuestion(
            attempt,
            topics,
            previousQuestions
        );

        await client.query(
            `UPDATE student_viva_attempts
             SET current_question = $1,
                 current_topic = $2,
                 current_question_number = $3
             WHERE id = $4
             AND student_id = $5`,
            [
                generated.question,
                generated.topic,
                nextNumber,
                attemptId,
                studentId
            ]
        );

        await client.query("COMMIT");

        return res.json({
            success: true,
            completed: false,
            question: generated.question,
            topic: generated.topic,
            questionNumber: nextNumber,
            totalQuestions: attempt.total_questions
        });

    } catch (error) {
        await client.query("ROLLBACK");
        console.error("Next Viva Question:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to generate next question"
        });

    } finally {
        client.release();
    }
};


// ======================================================
// 5. COMPLETE VIVA
// ======================================================

exports.completeViva = async (req, res) => {
    try {
        const studentId = getStudentId(req);
        const { attemptId } = req.params;

        if (!studentId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized"
            });
        }

        const result = await db.query(
            `UPDATE student_viva_attempts a
             SET status = 'Completed',
                 completed_at = NOW()
             WHERE a.id = $1
             AND a.student_id = $2
             AND a.status = 'In Progress'
             AND a.current_question IS NULL
             AND a.attempted_questions = a.total_questions
             RETURNING *`,
            [attemptId, studentId]
        );

        if (!result.rows.length) {
            return res.status(400).json({
                success: false,
                message: "All viva questions must be answered first"
            });
        }

        const report = result.rows[0];

        const percentage = (
            Number(report.total_score) /
            (Number(report.total_questions) * MAX_SCORE)
        ) * 100;

        return res.json({
            success: true,
            message: "Viva completed successfully",
            report: {
                ...report,
                percentage: Math.round(percentage * 100) / 100
            }
        });

    } catch (error) {
        console.error("Complete Viva:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to complete viva"
        });
    }
};


// ======================================================
// 6. STUDENT VIVA HISTORY
// ======================================================

exports.getVivaHistory = async (req, res) => {
    try {
        const studentId = getStudentId(req);

        if (!studentId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized"
            });
        }

        const result = await db.query(
            `SELECT
                a.*,
                v.title,
                v.subject,
                v.class_name
             FROM student_viva_attempts a
             JOIN admin_vivas v ON v.id = a.viva_id
             WHERE a.student_id = $1
             ORDER BY a.started_at DESC`,
            [studentId]
        );

        return res.json({
            success: true,
            history: result.rows
        });

    } catch (error) {
        console.error("Viva History:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to fetch viva history"
        });
    }
};


// ======================================================
// 7. STUDENT VIVA REPORT
// ======================================================

exports.getVivaReport = async (req, res) => {
    try {
        const studentId = getStudentId(req);
        const { attemptId } = req.params;

        if (!studentId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized"
            });
        }

        const attempt = await db.query(
            `SELECT
                a.*,
                v.title,
                v.subject,
                v.class_name
             FROM student_viva_attempts a
             JOIN admin_vivas v ON v.id = a.viva_id
             WHERE a.id = $1
             AND a.student_id = $2`,
            [attemptId, studentId]
        );

        if (!attempt.rows.length) {
            return res.status(404).json({
                success: false,
                message: "Viva report not found"
            });
        }

        const answers = await db.query(
            `SELECT *
             FROM student_viva_answers
             WHERE attempt_id = $1
             ORDER BY question_number`,
            [attemptId]
        );

        const report = attempt.rows[0];

        const totalPossible =
            Number(report.total_questions) * MAX_SCORE;

        const percentage = totalPossible > 0
            ? (Number(report.total_score) / totalPossible) * 100
            : 0;

        return res.json({
            success: true,
            report: {
                ...report,
                percentage: Math.round(percentage * 100) / 100
            },
            answers: answers.rows
        });

    } catch (error) {
        console.error("Viva Report:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to fetch viva report"
        });
    }
};
