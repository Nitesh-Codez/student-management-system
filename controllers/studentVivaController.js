
const db = require("../db");
const genAI = require("../config/gemini");

// ======================================================
// CONFIGURATION
// ======================================================

const MODEL_NAME =
    process.env.GEMINI_MODEL || "gemini-3.8-flash";

const MAX_SCORE = 10;
const MAX_ANSWER_LENGTH = 5000;
const MAX_QUESTION_LENGTH = 1000;
const MAX_QUESTIONS = 50;

// ======================================================
// COMMON HELPERS
// ======================================================

const getStudentId = (req) => {
    const id =
        req.user?.id ||
        req.body?.studentId ||
        req.query?.studentId;

    if (!id || !Number.isInteger(Number(id)) || Number(id) <= 0) {
        return null;
    }

    return Number(id);
};

const getStudentClass = async (studentId) => {
    const result = await db.query(
        "SELECT class FROM students WHERE id = $1",
        [studentId]
    );

    return result.rows[0]?.class || null;
};

const rollback = async (client) => {
    if (!client) return;

    try {
        await client.query("ROLLBACK");
    } catch (error) {
        console.error("Rollback error:", error.message);
    }
};

const isRetryableGeminiError = (error) => {
    const status = Number(error?.status || error?.code);

    return [429, 500, 502, 503, 504].includes(status);
};

const handleControllerError = (res, error, message) => {
    console.error(message, {
        message: error?.message,
        status: error?.status,
        code: error?.code
    });

    if (isRetryableGeminiError(error)) {
        return res.status(503).json({
            success: false,
            message: "AI service is temporarily busy. Please try again.",
            code: "AI_SERVICE_UNAVAILABLE"
        });
    }

    return res.status(500).json({
        success: false,
        message,
        error: error?.message
    });
};

// ======================================================
// GEMINI GENERATION
// ======================================================

const generateContent = async (prompt) => {
    if (!genAI?.models?.generateContent) {
        throw new Error("Gemini SDK is not configured correctly");
    }

    const response = await genAI.models.generateContent({
        model: MODEL_NAME,
        contents: prompt
    });

    const text = response?.text;

    if (typeof text !== "string" || !text.trim()) {
        throw new Error("Gemini returned an empty response");
    }

    return text.trim();
};

// ======================================================
// JSON EXTRACTION
// ======================================================

const extractJSON = (text) => {
    if (typeof text !== "string" || !text.trim()) {
        throw new Error("Empty Gemini response");
    }

    const cleaned = text
        .replace(/```json/gi, "")
        .replace(/```/g, "")
        .trim();

    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");

    if (start === -1 || end <= start) {
        throw new Error("Invalid Gemini JSON response");
    }

    try {
        return JSON.parse(cleaned.slice(start, end + 1));
    } catch {
        throw new Error("Gemini returned malformed JSON");
    }
};

// ======================================================
// VALIDATE GENERATED QUESTION
// ======================================================

const validateQuestion = (data, topics) => {
    if (
        typeof data?.topic !== "string" ||
        typeof data?.question !== "string"
    ) {
        throw new Error("Gemini returned invalid question structure");
    }

    const matchedTopic = topics.find(
        topic =>
            topic.trim().toLowerCase() ===
            data.topic.trim().toLowerCase()
    );

    const question = data.question.trim();

    if (!matchedTopic) {
        throw new Error("Gemini generated a topic outside admin configuration");
    }

    if (
        !question ||
        question.length > MAX_QUESTION_LENGTH
    ) {
        throw new Error("Invalid generated question");
    }

    return {
        topic: matchedTopic,
        question
    };
};

// ======================================================
// GET ADMIN CONFIGURED TOPICS
// ======================================================

const getVivaTopics = async (vivaId) => {
    const result = await db.query(
        `SELECT topic_name
         FROM admin_viva_topics
         WHERE viva_id = $1
         ORDER BY id ASC`,
        [vivaId]
    );

    const topics = result.rows
        .map(row => row.topic_name?.trim())
        .filter(Boolean);

    if (!topics.length) {
        throw new Error("No topics configured for this viva");
    }

    return topics;
};

// ======================================================
// GENERATE FIRST QUESTION
// ======================================================

const generateFirstQuestion = async (viva, topics) => {
    const prompt = `
You are an experienced school teacher conducting a real conversational oral viva.

CLASS: ${viva.class_name}
SUBJECT: ${viva.subject}
DIFFICULTY: ${viva.difficulty}

ADMIN CONFIGURED TOPICS:
${JSON.stringify(topics)}

TASK:
Generate ONLY ONE first viva question.

RULES:
1. Use only admin configured topics.
2. Select one topic from the configured list.
3. Generate a meaningful conceptual question.
4. Match the student's class level.
5. Use simple student-friendly language.
6. Do not generate answers.
7. Do not generate multiple questions.
8. Do not introduce external topics.
9. Avoid generic repetitive questions.

RETURN ONLY VALID JSON:

{
    "topic": "Exact configured topic",
    "question": "Your generated question"
}
`.trim();

    const raw = await generateContent(prompt);

    return validateQuestion(extractJSON(raw), topics);
};

// ======================================================
// GENERATE NEXT CONVERSATIONAL QUESTION
// ======================================================

const generateNextQuestion = async (
    viva,
    topics,
    history,
    previousQuestion,
    previousTopic
) => {
    const usedQuestions = history.map(item => item.question);

    const answeredTopics = history.map(item => item.topic_name);

    const prompt = `
You are an intelligent school teacher conducting a REAL-TIME
CONVERSATIONAL ORAL VIVA.

You must behave like a real interviewer, not a fixed question generator.

STUDENT DETAILS:

Class: ${viva.class_name}
Subject: ${viva.subject}
Difficulty: ${viva.difficulty}

ADMIN CONFIGURED TOPICS:
${JSON.stringify(topics)}

PREVIOUS QUESTION:
${previousQuestion}

PREVIOUS TOPIC:
${previousTopic}

STUDENT'S COMPLETE PREVIOUS ANSWERS AND EVALUATIONS:
${JSON.stringify(history)}

ALREADY ASKED QUESTIONS:
${JSON.stringify(usedQuestions)}

TOPICS ALREADY COVERED:
${JSON.stringify(answeredTopics)}

TASK:

Generate EXACTLY ONE next question.

CONVERSATIONAL INTELLIGENCE:

1. Carefully understand the student's previous answer.

2. If the student gives an incomplete answer:
   Ask a meaningful follow-up question to test understanding.

3. If the student gives a correct answer:
   You may increase the difficulty slightly or move to another topic.

4. If the student gives an incorrect answer:
   Ask a simpler conceptual question or move to another configured topic.

5. If the student gives an excellent answer:
   Ask an application-based or analytical follow-up.

6. If the student is struggling repeatedly:
   Gradually simplify the question.

7. Maintain a natural teacher-student conversation.

8. Do not repeat previous questions.

9. Do not ask questions outside admin configured topics.

10. You may continue the previous topic or select another configured topic.

11. Maintain the configured difficulty level overall.

12. Generate only ONE question.

13. Do not reveal the correct answer.

14. Do not generate explanations or feedback here.

IMPORTANT:
The question must genuinely depend on the student's previous responses.
Do not simply select a random question template.

RETURN ONLY VALID JSON:

{
    "topic": "Exact configured topic",
    "question": "New conversational viva question"
}
`.trim();

    const raw = await generateContent(prompt);

    return validateQuestion(extractJSON(raw), topics);
};

// ======================================================
// EVALUATE STUDENT ANSWER
// ======================================================

const evaluateAnswer = async (question, answer, viva) => {
    const prompt = `
You are an experienced ${viva.subject} teacher.

Class: ${viva.class_name}
Subject: ${viva.subject}
Difficulty: ${viva.difficulty}

QUESTION:
${question}

STUDENT ANSWER:
${answer}

Evaluate the student's conceptual understanding.

Maximum Marks: 10

RULES:
1. Score between 0 and 10.
2. Give partial marks for partially correct answers.
3. Do not award marks for unrelated answers.
4. Be fair to short but correct answers.
5. Do not penalize spelling unless meaning changes.
6. Feedback must be simple and constructive.
7. Do not assume facts absent from the answer.
8. isCorrect should be true only when the answer is substantially correct.

RETURN ONLY VALID JSON:

{
    "score": 0,
    "feedback": "Constructive feedback",
    "isCorrect": false
}
`.trim();

    const raw = await generateContent(prompt);

    const data = extractJSON(raw);

    const score = Number(data.score);

    if (
        !Number.isFinite(score) ||
        score < 0 ||
        score > MAX_SCORE ||
        typeof data.feedback !== "string" ||
        !data.feedback.trim() ||
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
            return res.status(400).json({
                success: false,
                message: "Valid studentId is required"
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
                    WHEN CURRENT_DATE < v.start_date THEN 'Upcoming'
                    WHEN CURRENT_DATE > v.end_date THEN 'Expired'
                    ELSE 'Available'
                END AS availability_status
             FROM admin_vivas v
             LEFT JOIN admin_viva_topics t
                ON t.viva_id = v.id
             WHERE LOWER(TRIM(v.class_name)) =
                   LOWER(TRIM($1))
               AND LOWER(TRIM(v.status)) = 'active'
               AND v.end_date >= CURRENT_DATE
             GROUP BY v.id
             ORDER BY v.start_date ASC`,
            [String(className)]
        );

        return res.json({
            success: true,
            studentId,
            studentClass: className,
            total: result.rows.length,
            vivas: result.rows
        });

    } catch (error) {
        return handleControllerError(
            res, error, "Unable to fetch available vivas"
        );
    }
};

// ======================================================
// 2. START VIVA
// Gemini generates ONLY the first question.
// ======================================================

exports.startViva = async (req, res) => {
    let client;

    try {
        const studentId = getStudentId(req);
        const vivaId = Number(req.params.id);

        if (
            !studentId ||
            !Number.isInteger(vivaId) ||
            vivaId <= 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid student or viva ID"
            });
        }

        const className = await getStudentClass(studentId);

        if (!className) {
            return res.status(404).json({
                success: false,
                message: "Student class not found"
            });
        }

        // Check existing attempt first.

        const existing = await db.query(
            `SELECT *
             FROM student_viva_attempts
             WHERE viva_id = $1
               AND student_id = $2
               AND status = 'In Progress'
             ORDER BY id DESC
             LIMIT 1`,
            [vivaId, studentId]
        );

        if (existing.rows.length) {
            const attempt = existing.rows[0];

            return res.json({
                success: true,
                message: "Existing viva resumed",
                attemptId: attempt.id,
                question: attempt.current_question,
                topic: attempt.current_topic,
                questionNumber: attempt.current_question_number,
                totalQuestions: attempt.total_questions,
                needsNextQuestion: !attempt.current_question
            });
        }

        // Fetch active viva.

        const vivaResult = await db.query(
            `SELECT *
             FROM admin_vivas
             WHERE id = $1
               AND LOWER(TRIM(class_name)) =
                   LOWER(TRIM($2))
               AND LOWER(TRIM(status)) = 'active'
               AND CURRENT_DATE BETWEEN start_date AND end_date`,
            [vivaId, className]
        );

        if (!vivaResult.rows.length) {
            return res.status(404).json({
                success: false,
                message: "Viva is unavailable or expired"
            });
        }

        const viva = vivaResult.rows[0];

        const quantity = Number(viva.total_questions);

        if (
            !Number.isInteger(quantity) ||
            quantity < 1 ||
            quantity > MAX_QUESTIONS
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid viva question quantity"
            });
        }

        const topics = await getVivaTopics(vivaId);

        // Generate first question using Gemini.

        const startedAt = Date.now();

        const firstQuestion = await generateFirstQuestion(
            viva,
            topics
        );

        console.log(
            `First question generated in ${Date.now() - startedAt}ms`
        );

        // Create attempt only after successful generation.

        client = await db.connect();

        await client.query("BEGIN");

        // Serialize attempt creation.

        const lockedViva = await client.query(
            `SELECT *
             FROM admin_vivas
             WHERE id = $1
             AND LOWER(TRIM(class_name)) = LOWER(TRIM($2))
             AND LOWER(TRIM(status)) = 'active'
             AND CURRENT_DATE BETWEEN start_date AND end_date
             FOR UPDATE`,
            [vivaId, className]
        );

        if (!lockedViva.rows.length) {
            await client.query("ROLLBACK");

            return res.status(404).json({
                success: false,
                message: "Viva is unavailable or expired"
            });
        }

        // Check duplicate attempt again.

        const recheck = await client.query(
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

        if (recheck.rows.length) {
            await client.query("COMMIT");

            const attempt = recheck.rows[0];

            return res.json({
                success: true,
                message: "Existing viva resumed",
                attemptId: attempt.id,
                question: attempt.current_question,
                topic: attempt.current_topic,
                questionNumber: attempt.current_question_number,
                totalQuestions: attempt.total_questions,
                needsNextQuestion: !attempt.current_question
            });
        }

        // Attempt limit.

        const countResult = await client.query(
            `SELECT COUNT(*)::INTEGER AS attempts
             FROM student_viva_attempts
             WHERE viva_id = $1
               AND student_id = $2`,
            [vivaId, studentId]
        );

        if (
            Number(countResult.rows[0].attempts) >=
            Number(lockedViva.rows[0].attempt_limit)
        ) {
            await client.query("ROLLBACK");

            return res.status(403).json({
                success: false,
                message: "Viva attempt limit reached"
            });
        }

        // Create attempt with first question.

        const attemptResult = await client.query(
            `INSERT INTO student_viva_attempts
            (
                viva_id,
                student_id,
                total_questions,
                current_question,
                current_topic,
                current_question_number
            )
            VALUES ($1, $2, $3, $4, $5, 1)
            RETURNING *`,
            [
                vivaId,
                studentId,
                quantity,
                firstQuestion.question,
                firstQuestion.topic
            ]
        );

        await client.query("COMMIT");

        const attemptId = attemptResult.rows[0].id;

        return res.status(201).json({
            success: true,
            message: "AI Viva started successfully",
            attemptId,
            question: firstQuestion.question,
            topic: firstQuestion.topic,
            questionNumber: 1,
            totalQuestions: quantity
        });

    } catch (error) {
        if (client) {
            await rollback(client);
        }

        return handleControllerError(
            res, error, "Unable to start viva"
        );

    } finally {
        if (client) client.release();
    }
};

// ======================================================
// 3. SUBMIT ANSWER AND EVALUATE
// ======================================================

exports.submitVivaAnswer = async (req, res) => {
    let client;

    try {
        const studentId = getStudentId(req);
        const attemptId = Number(req.params.attemptId);
        const answer = req.body?.answer;

        if (
            !studentId ||
            !Number.isInteger(attemptId) ||
            attemptId <= 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid student or attempt ID"
            });
        }

        if (
            typeof answer !== "string" ||
            !answer.trim() ||
            answer.trim().length > MAX_ANSWER_LENGTH
        ) {
            return res.status(400).json({
                success: false,
                message: "Valid answer is required"
            });
        }

        // Fetch attempt.

        const attemptResult = await db.query(
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
               AND CURRENT_DATE <= v.end_date`,
            [attemptId, studentId]
        );

        if (!attemptResult.rows.length) {
            return res.status(404).json({
                success: false,
                message: "Active viva attempt not found"
            });
        }

        const attempt = attemptResult.rows[0];

        if (!attempt.current_question) {
            return res.status(400).json({
                success: false,
                message: "No pending question available"
            });
        }

        const questionNumber =
            Number(attempt.current_question_number);

        // Evaluate with Gemini.

        const evaluation = await evaluateAnswer(
            attempt.current_question,
            answer.trim(),
            attempt
        );

        client = await db.connect();

        await client.query("BEGIN");

        // Lock current attempt.

        const locked = await client.query(
            `SELECT *
             FROM student_viva_attempts
             WHERE id = $1
               AND student_id = $2
               AND status = 'In Progress'
               AND current_question_number = $3
               AND current_question = $4
             FOR UPDATE`,
            [
                attemptId,
                studentId,
                questionNumber,
                attempt.current_question
            ]
        );

        if (!locked.rows.length) {
            await client.query("ROLLBACK");

            return res.status(409).json({
                success: false,
                message: "Question already submitted or changed"
            });
        }

        // Save answer and evaluation.

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

        // Clear current question.
        // Next API will generate a fresh Gemini question.

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
            savedAnswer: saved.rows[0],
            nextQuestionAvailable:
                questionNumber < Number(attempt.total_questions)
        });

    } catch (error) {
        if (client) {
            await rollback(client);
        }

        return handleControllerError(
            res, error, "Unable to evaluate answer"
        );

    } finally {
        if (client) client.release();
    }
};

// ======================================================
// 4. GET NEXT QUESTION
// Every new question is generated by Gemini.
// ======================================================

exports.getNextQuestion = async (req, res) => {
    let client;

    try {
        const studentId = getStudentId(req);
        const attemptId = Number(req.params.attemptId);

        if (
            !studentId ||
            !Number.isInteger(attemptId) ||
            attemptId <= 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid student or attempt ID"
            });
        }

        // Fetch attempt.

        const result = await db.query(
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
               AND CURRENT_DATE <= v.end_date`,
            [attemptId, studentId]
        );

        if (!result.rows.length) {
            return res.status(404).json({
                success: false,
                message: "Active attempt not found"
            });
        }

        const attempt = result.rows[0];

        // If question already exists, resume it.

        if (attempt.current_question) {
            return res.json({
                success: true,
                completed: false,
                resumed: true,
                question: attempt.current_question,
                topic: attempt.current_topic,
                questionNumber: attempt.current_question_number,
                totalQuestions: attempt.total_questions
            });
        }

        const nextNumber =
            Number(attempt.attempted_questions) + 1;

        // Check completion.

        if (nextNumber > Number(attempt.total_questions)) {
            return res.json({
                success: true,
                completed: true,
                message: "All questions answered"
            });
        }

        // Get admin topics.

        const topics = await getVivaTopics(attempt.viva_id);

        // Get complete previous conversation.

        const historyResult = await db.query(
            `SELECT
                question_number,
                topic_name,
                question,
                student_answer,
                score,
                feedback,
                is_correct
             FROM student_viva_answers
             WHERE attempt_id = $1
             ORDER BY question_number ASC`,
            [attemptId]
        );

        const history = historyResult.rows;

        if (!history.length) {
            throw new Error("Previous answer history not found");
        }

        const lastAnswer = history[history.length - 1];

        // Ask Gemini to generate next question.

        const generationStartedAt = Date.now();

        const nextQuestion = await generateNextQuestion(
            attempt,
            topics,
            history,
            lastAnswer.question,
            lastAnswer.topic_name
        );

        console.log(
            `AI next question generated in ${
                Date.now() - generationStartedAt
            }ms`
        );

        // Save generated question.
        // Conditional update prevents overwriting an already
        // assigned question if another request arrived.

        client = await db.connect();

        await client.query("BEGIN");

        const saved = await client.query(
            `UPDATE student_viva_attempts
             SET current_question = $1,
                 current_topic = $2,
                 current_question_number = $3
             WHERE id = $4
               AND student_id = $5
               AND status = 'In Progress'
               AND current_question IS NULL
               AND attempted_questions = $6
             RETURNING *`,
            [
                nextQuestion.question,
                nextQuestion.topic,
                nextNumber,
                attemptId,
                studentId,
                Number(attempt.attempted_questions)
            ]
        );

        if (!saved.rows.length) {
            // Another request may have assigned the question.

            const latest = await client.query(
                `SELECT *
                 FROM student_viva_attempts
                 WHERE id = $1
                   AND student_id = $2`,
                [attemptId, studentId]
            );

            await client.query("COMMIT");

            const current = latest.rows[0];

            if (!current) {
                return res.status(404).json({
                    success: false,
                    message: "Attempt not found"
                });
            }

            return res.json({
                success: true,
                completed: false,
                resumed: true,
                question: current.current_question,
                topic: current.current_topic,
                questionNumber: current.current_question_number,
                totalQuestions: current.total_questions
            });
        }

        await client.query("COMMIT");

        return res.json({
            success: true,
            completed: false,
            resumed: false,
            message: "New AI question generated",
            question: nextQuestion.question,
            topic: nextQuestion.topic,
            questionNumber: nextNumber,
            totalQuestions: attempt.total_questions
        });

    } catch (error) {
        if (client) {
            await rollback(client);
        }

        return handleControllerError(
            res, error, "Unable to generate next question"
        );

    } finally {
        if (client) client.release();
    }
};

// ======================================================
// 5. COMPLETE VIVA
// ======================================================

exports.completeViva = async (req, res) => {
    try {
        const studentId = getStudentId(req);
        const attemptId = Number(req.params.attemptId);

        if (
            !studentId ||
            !Number.isInteger(attemptId) ||
            attemptId <= 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid student or attempt ID"
            });
        }

        const result = await db.query(
            `UPDATE student_viva_attempts
             SET status = 'Completed',
                 completed_at = NOW()
             WHERE id = $1
               AND student_id = $2
               AND status = 'In Progress'
               AND current_question IS NULL
               AND attempted_questions = total_questions
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

        const totalPossible =
            Number(report.total_questions) * MAX_SCORE;

        const percentage = totalPossible > 0
            ? (Number(report.total_score) / totalPossible) * 100
            : 0;

        return res.json({
            success: true,
            message: "Viva completed successfully",
            report: {
                ...report,
                percentage: Math.round(percentage * 100) / 100
            }
        });

    } catch (error) {
        return handleControllerError(
            res, error, "Unable to complete viva"
        );
    }
};

// ======================================================
// 6. STUDENT VIVA HISTORY
// ======================================================

exports.getVivaHistory = async (req, res) => {
    try {
        const studentId = getStudentId(req);

        if (!studentId) {
            return res.status(400).json({
                success: false,
                message: "Valid studentId is required"
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
            total: result.rows.length,
            history: result.rows
        });

    } catch (error) {
        return handleControllerError(
            res, error, "Unable to fetch viva history"
        );
    }
};

// ======================================================
// 7. STUDENT VIVA REPORT
// ======================================================

exports.getVivaReport = async (req, res) => {
    try {
        const studentId = getStudentId(req);
        const attemptId = Number(req.params.attemptId);

        if (
            !studentId ||
            !Number.isInteger(attemptId) ||
            attemptId <= 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid student or attempt ID"
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
             ORDER BY question_number ASC`,
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
        return handleControllerError(
            res, error, "Unable to fetch viva report"
        );
    }
};
