const db = require("../db");

// ======================================================
// CONFIGURATION
// ======================================================

const GROQ_API_KEY = (process.env.GROQ_API_KEY || "").trim();
const GROQ_MODEL = (
    process.env.GROQ_MODEL || "openai/gpt-oss-20b"
).trim();

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
        req.body?.student_id ||
        req.query?.studentId ||
        req.query?.student_id;

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

const isRetryableAIError = (error) => {
    const status = Number(error?.status || error?.code);
    return [429, 500, 502, 503, 504].includes(status);
};

const handleControllerError = (res, error, message) => {
    console.error(message, {
        message: error?.message,
        status: error?.status,
        code: error?.code
    });

    if (isRetryableAIError(error)) {
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
// GROQ GENERATION & PARSING
// ======================================================

const extractGroqText = (data) => {
    const msg = data?.choices?.[0]?.message;
    if (!msg) return "";

    if (typeof msg.content === "string" && msg.content.trim()) {
        return msg.content.trim();
    }

    if (Array.isArray(msg.content)) {
        const joined = msg.content
            .map((part) => (typeof part === "string" ? part : part?.text || ""))
            .join(" ")
            .trim();
        if (joined) return joined;
    }

    if (typeof data?.choices?.[0]?.text === "string" && data.choices[0].text.trim()) {
        return data.choices[0].text.trim();
    }

    return "";
};

const generateContent = async (messages, maxTokens = 800) => {
    if (!GROQ_API_KEY) {
        throw new Error("GROQ_API_KEY is not configured on backend");
    }

    for (let attempt = 0; attempt < 2; attempt++) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 15000);

        try {
            const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${GROQ_API_KEY}`
                },
                body: JSON.stringify({
                    model: GROQ_MODEL,
                    messages,
                    temperature: 0.5,
                    max_tokens: maxTokens
                }),
                signal: controller.signal
            });

            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                const err = new Error(data?.error?.message || `Groq HTTP ${res.status}`);
                err.status = res.status;
                throw err;
            }

            const text = extractGroqText(data);
            if (text) {
                return text;
            }
        } finally {
            clearTimeout(timer);
        }
    }

    throw new Error("Groq returned an empty response");
};

const extractJSON = (text) => {
    if (typeof text !== "string" || !text.trim()) {
        throw new Error("Empty AI response");
    }

    const cleaned = text
        .replace(/```json/gi, "")
        .replace(/```/g, "")
        .trim();

    const startObj = cleaned.indexOf("{");
    const endObj = cleaned.lastIndexOf("}");
    const startArr = cleaned.indexOf("[");
    const endArr = cleaned.lastIndexOf("]");

    let rawSlice = "";
    if (startArr !== -1 && endArr > startArr && (startObj === -1 || startArr < startObj)) {
        rawSlice = cleaned.slice(startArr, endArr + 1);
    } else if (startObj !== -1 && endObj > startObj) {
        rawSlice = cleaned.slice(startObj, endObj + 1);
    } else {
        throw new Error("Invalid AI JSON response");
    }

    try {
        return JSON.parse(rawSlice);
    } catch {
        throw new Error("AI returned malformed JSON");
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
        throw new Error("AI returned invalid question structure");
    }

    const matchedTopic = topics.find(
        (topic) =>
            topic.trim().toLowerCase() ===
            data.topic.trim().toLowerCase()
    );

    const question = data.question.trim();

    if (!matchedTopic) {
        throw new Error("AI generated a topic outside admin configuration");
    }

    if (!question || question.length > MAX_QUESTION_LENGTH) {
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
        .map((row) => row.topic_name?.trim())
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
    const messages = [
        {
            role: "system",
            content:
                "You are an experienced school teacher conducting a real conversational oral viva. Return ONLY valid JSON."
        },
        {
            role: "user",
            content: `
CLASS: ${viva.class_name}
SUBJECT: ${viva.subject}
DIFFICULTY: ${viva.difficulty}

ADMIN CONFIGURED TOPICS:
${JSON.stringify(topics)}

Generate ONLY ONE first viva question using one of the configured topics.
Return ONLY valid JSON:
{
    "topic": "Exact configured topic",
    "question": "Your generated question"
}
`.trim()
        }
    ];

    const raw = await generateContent(messages, 450);
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
    const usedQuestions = history.map((item) => item.question);
    const answeredTopics = history.map((item) => item.topic_name);

    const messages = [
        {
            role: "system",
            content:
                "You are an intelligent school teacher conducting a real-time conversational oral viva. Return ONLY valid JSON."
        },
        {
            role: "user",
            content: `
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

Generate EXACTLY ONE next question based on the student's previous response and configured topics.
Return ONLY valid JSON:
{
    "topic": "Exact configured topic",
    "question": "New conversational viva question"
}
`.trim()
        }
    ];

    const raw = await generateContent(messages, 500);
    return validateQuestion(extractJSON(raw), topics);
};

// ======================================================
// EVALUATE SINGLE ANSWER
// ======================================================

const evaluateAnswer = async (question, answer, viva) => {
    const messages = [
        {
            role: "system",
            content:
                "You are an experienced school teacher evaluating a student's viva answer out of 10. Return ONLY valid JSON."
        },
        {
            role: "user",
            content: `
Class: ${viva.class_name}
Subject: ${viva.subject}
Difficulty: ${viva.difficulty}

QUESTION:
${question}

STUDENT ANSWER:
${answer}

Score between 0 and 10. Give partial marks for partially correct answers, 0 for unrelated answers, and fair marks for short accurate answers.
Return ONLY valid JSON:
{
    "score": 0,
    "feedback": "Constructive feedback",
    "isCorrect": false
}
`.trim()
        }
    ];

    const raw = await generateContent(messages, 450);
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
// EVALUATE ALL Q&A IN ONE BATCH
// ======================================================

const evaluateBatchAnswers = async (qaItems, viva, configuredTopics = []) => {
    const messages = [
        {
            role: "system",
            content:
                "You are an experienced school teacher grading a student's complete viva. Each item is scored from 0 to 10. Return ONLY valid JSON."
        },
        {
            role: "user",
            content: `
Class: ${viva.class_name || "10th"}
Subject: ${viva.subject || "General"}
Difficulty: ${viva.difficulty || "Medium"}
Configured Topics: ${JSON.stringify(configuredTopics)}

Evaluate every question-answer pair below:
${JSON.stringify(qaItems)}

Rules:
1. Return an array of length ${qaItems.length}, one object per item in exact order.
2. "score" must be a number between 0 and 10 (partial marks allowed; 0 for unrelated/empty).
3. "feedback" must be short, clear, and constructive.
4. "isCorrect" must be boolean (true if substantially correct).

Return ONLY valid JSON in this exact format:
{
    "evaluations": [
        {
            "question_number": 1,
            "score": 7,
            "feedback": "Good explanation.",
            "isCorrect": true
        }
    ]
}
`.trim()
        }
    ];

    const raw = await generateContent(messages, Math.max(600, qaItems.length * 180));
    const parsed = extractJSON(raw);
    const list = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed?.evaluations)
        ? parsed.evaluations
        : null;

    if (!list || list.length !== qaItems.length) {
        throw new Error("Batch evaluation count mismatch");
    }

    return list.map((item, idx) => {
        const rawScore = Number(item?.score);
        const safeScore = Number.isFinite(rawScore)
            ? Math.max(0, Math.min(MAX_SCORE, Math.round(rawScore * 100) / 100))
            : 0;

        return {
            question_number: qaItems[idx].question_number,
            score: safeScore,
            feedback:
                typeof item?.feedback === "string" && item.feedback.trim()
                    ? item.feedback.trim()
                    : "Answer recorded.",
            isCorrect:
                typeof item?.isCorrect === "boolean"
                    ? item.isCorrect
                    : safeScore >= 6
        };
    });
};

// ======================================================
// NORMALIZE SUBMITTED Q&A PAYLOAD
// ======================================================

const normalizeSubmittedQa = (body = {}, defaultTopic = "General") => {
    if (Array.isArray(body.qa) && body.qa.length > 0) {
        return body.qa.map((item, index) => ({
            question_number: Number(item?.question_number) || index + 1,
            topic_name: String(item?.topic || item?.topic_name || defaultTopic).trim() || defaultTopic,
            question: String(item?.question || "").trim(),
            answer: String(item?.answer ?? item?.student_answer ?? "").trim()
        }));
    }

    const questions = Array.isArray(body.questions) ? body.questions : [];
    const answers = Array.isArray(body.answers) ? body.answers : [];
    const len = Math.max(questions.length, answers.length);

    const pairs = [];
    for (let i = 0; i < len; i++) {
        pairs.push({
            question_number: i + 1,
            topic_name: defaultTopic,
            question: String(questions[i] ?? "").trim(),
            answer: String(answers[i] ?? "").trim()
        });
    }
    return pairs;
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
// ======================================================

exports.startViva = async (req, res) => {
    let client;

    try {
        const studentId = getStudentId(req);
        const vivaId = Number(req.params.id);

        if (!studentId || !Number.isInteger(vivaId) || vivaId <= 0) {
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

        const vivaResult = await db.query(
            `SELECT *
             FROM admin_vivas
             WHERE id = $1
               AND LOWER(TRIM(class_name)) = LOWER(TRIM($2))
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

        if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUESTIONS) {
            return res.status(400).json({
                success: false,
                message: "Invalid viva question quantity"
            });
        }

        const topics = await getVivaTopics(vivaId);
        const firstQuestion = await generateFirstQuestion(viva, topics);

        client = await db.connect();
        await client.query("BEGIN");

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

        const countResult = await client.query(
            `SELECT COUNT(*)::INTEGER AS attempts
             FROM student_viva_attempts
             WHERE viva_id = $1
               AND student_id = $2`,
            [vivaId, studentId]
        );

        if (Number(countResult.rows[0].attempts) >= Number(lockedViva.rows[0].attempt_limit)) {
            await client.query("ROLLBACK");
            return res.status(403).json({
                success: false,
                message: "Viva attempt limit reached"
            });
        }

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

        return res.status(201).json({
            success: true,
            message: "AI Viva started successfully",
            attemptId: attemptResult.rows[0].id,
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
// 3. SUBMIT SINGLE ANSWER AND EVALUATE
// ======================================================

exports.submitVivaAnswer = async (req, res) => {
    let client;

    try {
        const studentId = getStudentId(req);
        const attemptId = Number(req.params.attemptId);
        const answer = req.body?.answer;

        if (!studentId || !Number.isInteger(attemptId) || attemptId <= 0) {
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

        const questionNumber = Number(attempt.current_question_number);
        const evaluation = await evaluateAnswer(
            attempt.current_question,
            answer.trim(),
            attempt
        );

        client = await db.connect();
        await client.query("BEGIN");

        const locked = await client.query(
            `SELECT *
             FROM student_viva_attempts
             WHERE id = $1
               AND student_id = $2
               AND status = 'In Progress'
               AND current_question_number = $3
               AND current_question = $4
             FOR UPDATE`,
            [attemptId, studentId, questionNumber, attempt.current_question]
        );

        if (!locked.rows.length) {
            await client.query("ROLLBACK");
            return res.status(409).json({
                success: false,
                message: "Question already submitted or changed"
            });
        }

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
            savedAnswer: saved.rows[0],
            nextQuestionAvailable: questionNumber < Number(attempt.total_questions)
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
// ======================================================

exports.getNextQuestion = async (req, res) => {
    let client;

    try {
        const studentId = getStudentId(req);
        const attemptId = Number(req.params.attemptId);

        if (!studentId || !Number.isInteger(attemptId) || attemptId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid student or attempt ID"
            });
        }

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

        const nextNumber = Number(attempt.attempted_questions) + 1;
        if (nextNumber > Number(attempt.total_questions)) {
            return res.json({
                success: true,
                completed: true,
                message: "All questions answered"
            });
        }

        const topics = await getVivaTopics(attempt.viva_id);
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
        const nextQuestion = await generateNextQuestion(
            attempt,
            topics,
            history,
            lastAnswer.question,
            lastAnswer.topic_name
        );

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
// 5. COMPLETE VIVA (BATCH SAVE + BATCH EVALUATE + MARKS)
// POST /api/student/viva/attempt/:attemptId/submit
// ======================================================

exports.completeViva = async (req, res) => {
    let client;

    try {
        const studentId = getStudentId(req);
        const attemptId = Number(req.params.attemptId);

        if (!studentId || !Number.isInteger(attemptId) || attemptId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid student or attempt ID"
            });
        }

        const attemptRes = await db.query(
            `SELECT
                a.*,
                v.subject,
                v.class_name,
                v.difficulty,
                v.total_questions AS viva_total_questions
             FROM student_viva_attempts a
             JOIN admin_vivas v ON v.id = a.viva_id
             WHERE a.id = $1
               AND a.student_id = $2`,
            [attemptId, studentId]
        );

        if (!attemptRes.rows.length) {
            return res.status(404).json({
                success: false,
                message: "Viva attempt not found"
            });
        }

        const attempt = attemptRes.rows[0];
        if (attempt.status === "Completed") {
            const existingAnswers = await db.query(
                `SELECT *
                 FROM student_viva_answers
                 WHERE attempt_id = $1
                 ORDER BY question_number ASC`,
                [attemptId]
            );

            return res.json({
                success: true,
                message: "Viva already completed",
                report: attempt,
                answers: existingAnswers.rows
            });
        }

        const defaultTopic =
            attempt.current_topic ||
            req.body?.topic ||
            attempt.subject ||
            "General";

        const qaItems = normalizeSubmittedQa(req.body, defaultTopic).filter(
            (item) => item.question && item.answer
        );

        if (!qaItems.length) {
            return res.status(400).json({
                success: false,
                message: "Questions and answers are required to submit viva"
            });
        }

        for (const item of qaItems) {
            if (
                item.question.length > MAX_QUESTION_LENGTH ||
                item.answer.length > MAX_ANSWER_LENGTH
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Question or answer exceeds maximum length"
                });
            }
        }

        let configuredTopics = [];
        try {
            configuredTopics = await getVivaTopics(attempt.viva_id);
        } catch {
            configuredTopics = [];
        }

        const evaluations = await evaluateBatchAnswers(
            qaItems,
            attempt,
            configuredTopics
        );

        const totalScore = Math.round(
            evaluations.reduce((sum, ev) => sum + Number(ev.score || 0), 0) * 100
        ) / 100;

        const answeredCount = qaItems.length;
        const totalQuestions =
            Number(attempt.total_questions || attempt.viva_total_questions) ||
            answeredCount;

        client = await db.connect();
        await client.query("BEGIN");

        await client.query(
            `DELETE FROM student_viva_answers
             WHERE attempt_id = $1`,
            [attemptId]
        );

        const savedAnswers = [];
        for (let i = 0; i < qaItems.length; i++) {
            const qItem = qaItems[i];
            const ev = evaluations[i];

            const inserted = await client.query(
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
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                RETURNING *`,
                [
                    attemptId,
                    qItem.question_number,
                    qItem.topic_name,
                    qItem.question,
                    qItem.answer,
                    ev.score,
                    MAX_SCORE,
                    ev.feedback,
                    ev.isCorrect
                ]
            );

            savedAnswers.push(inserted.rows[0]);
        }

        const updatedAttempt = await client.query(
            `UPDATE student_viva_attempts
             SET status = 'Completed',
                 attempted_questions = $1,
                 total_questions = $2,
                 total_score = $3,
                 current_question = NULL,
                 current_topic = NULL,
                 current_question_number = NULL,
                 completed_at = NOW()
             WHERE id = $4
               AND student_id = $5
             RETURNING *`,
            [answeredCount, totalQuestions, totalScore, attemptId, studentId]
        );

        await client.query("COMMIT");

        const report = updatedAttempt.rows[0];
        const totalPossible = Number(report.total_questions) * MAX_SCORE;
        const percentage =
            totalPossible > 0
                ? Math.round((Number(report.total_score) / totalPossible) * 10000) / 100
                : 0;

        return res.json({
            success: true,
            message: "Viva submitted, saved, and evaluated successfully",
            report: {
                ...report,
                percentage
            },
            answers: savedAnswers
        });
    } catch (error) {
        if (client) {
            await rollback(client);
        }
        return handleControllerError(
            res, error, "Unable to complete and evaluate viva"
        );
    } finally {
        if (client) client.release();
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
            studentId,
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
// 7. GET VIVA REPORT BY ATTEMPT ID
// GET /api/student/viva/report/:attemptId
// ======================================================

exports.getVivaReport = async (req, res) => {
    try {
        const studentId = getStudentId(req);
        const attemptId = Number(req.params.attemptId);

        if (!studentId || !Number.isInteger(attemptId) || attemptId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Valid studentId and attemptId are required"
            });
        }

        const attemptRes = await db.query(
            `SELECT
                a.*,
                v.title,
                v.subject,
                v.class_name,
                v.difficulty
             FROM student_viva_attempts a
             LEFT JOIN admin_vivas v ON v.id = a.viva_id
             WHERE a.id = $1
               AND a.student_id = $2`,
            [attemptId, studentId]
        );

        if (!attemptRes.rows.length) {
            return res.status(404).json({
                success: false,
                message: "Viva attempt report not found"
            });
        }

        const answersRes = await db.query(
            `SELECT *
             FROM student_viva_answers
             WHERE attempt_id = $1
             ORDER BY question_number ASC, id ASC`,
            [attemptId]
        );

        const attempt = attemptRes.rows[0];
        const totalQuestions =
            Number(attempt.total_questions) || answersRes.rows.length || 0;
        const totalScore = Number(attempt.total_score) || 0;
        const maxPossible = totalQuestions * MAX_SCORE;
        const percentage =
            maxPossible > 0
                ? Math.round((totalScore / maxPossible) * 10000) / 100
                : 0;

        return res.json({
            success: true,
            report: {
                ...attempt,
                percentage
            },
            answers: answersRes.rows
        });
    } catch (error) {
        return handleControllerError(
            res,
            error,
            "Unable to fetch viva report"
        );
    }
};