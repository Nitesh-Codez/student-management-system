
const db = require("../db");

// ======================================================
// ADMIN VIVA CONTROLLER
// ======================================================

// 1. CREATE VIVA

exports.createViva = async (req, res) => {
    let client;

    try {
        client = await db.connect();

        const {
            title,
            className,
            class_name,
            subject,
            description,
            topics,
            startDate,
            start_date,
            endDate,
            end_date,
            totalQuestions,
            total_questions,
            durationMinutes,
            duration_minutes,
            difficulty = "Mixed",
            attemptLimit,
            attempt_limit,
            status = "Active"
        } = req.body;

        // Support both camelCase and snake_case
        const finalClassName = className || class_name;
        const finalStartDate = startDate || start_date;
        const finalEndDate = endDate || end_date;

        const finalTotalQuestions =
            Number(totalQuestions ?? total_questions ?? 10);

        const finalDuration =
            Number(durationMinutes ?? duration_minutes ?? 10);

        const finalAttemptLimit =
            Number(attemptLimit ?? attempt_limit ?? 1);

        if (
            !title?.trim() ||
            !finalClassName ||
            !subject?.trim() ||
            !Array.isArray(topics) ||
            topics.length === 0 ||
            !finalStartDate ||
            !finalEndDate
        ) {
            return res.status(400).json({
                success: false,
                message: "Please provide all required viva details"
            });
        }

        const cleanTopics = [
            ...new Set(
                topics
                    .filter(t => typeof t === "string")
                    .map(t => t.trim())
                    .filter(Boolean)
            )
        ];

        if (
            !cleanTopics.length ||
            cleanTopics.length !== topics.length
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid or duplicate topics"
            });
        }

        if (finalEndDate < finalStartDate) {
            return res.status(400).json({
                success: false,
                message: "End date cannot be before start date"
            });
        }

        if (
            !Number.isInteger(finalTotalQuestions) ||
            finalTotalQuestions < 1 ||
            finalTotalQuestions > 50 ||
            !Number.isInteger(finalDuration) ||
            finalDuration < 1 ||
            !Number.isInteger(finalAttemptLimit) ||
            finalAttemptLimit < 1
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid viva settings"
            });
        }

        if (!["Easy", "Medium", "Hard", "Mixed"].includes(difficulty)) {
            return res.status(400).json({
                success: false,
                message: "Invalid difficulty"
            });
        }

        if (!["Draft", "Active", "Inactive"].includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Invalid status"
            });
        }

        await client.query("BEGIN");

        const vivaResult = await client.query(
            `INSERT INTO admin_vivas (
                title,
                class_name,
                subject,
                description,
                start_date,
                end_date,
                total_questions,
                duration_minutes,
                difficulty,
                attempt_limit,
                status,
                created_by
            )
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
            RETURNING *`,
            [
                title.trim(),
                finalClassName,
                subject.trim(),
                description || null,
                finalStartDate,
                finalEndDate,
                finalTotalQuestions,
                finalDuration,
                difficulty,
                finalAttemptLimit,
                status,
                req.user?.id ?? null
            ]
        );

        const vivaId = vivaResult.rows[0].id;

        for (const topic of cleanTopics) {
            await client.query(
                `INSERT INTO admin_viva_topics
                (viva_id, topic_name)
                VALUES ($1, $2)`,
                [vivaId, topic]
            );
        }

        await client.query("COMMIT");

        return res.status(201).json({
            success: true,
            message: "Viva created successfully",
            viva: vivaResult.rows[0],
            topics: cleanTopics
        });

    } catch (error) {
        if (client) {
            await client.query("ROLLBACK").catch(() => {});
        }

        console.error("Create Viva Error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to create viva",
            error: error.message
        });

    } finally {
        if (client) client.release();
    }
};



// ======================================================
// 2. GET ALL VIVAS
// ======================================================

exports.getAllVivas = async (req, res) => {
    try {
        const result = await db.query(
            `SELECT
                v.*,
                COALESCE(
                    ARRAY_AGG(DISTINCT t.topic_name)
                    FILTER (WHERE t.id IS NOT NULL),
                    '{}'
                ) AS topics,
                COUNT(DISTINCT a.student_id)::INTEGER
                    AS students_attempted
             FROM admin_vivas v
             LEFT JOIN admin_viva_topics t
                ON t.viva_id = v.id
             LEFT JOIN student_viva_attempts a
                ON a.viva_id = v.id
             GROUP BY v.id
             ORDER BY v.created_at DESC`
        );

        return res.json({
            success: true,
            vivas: result.rows
        });

    } catch (error) {
        console.error("Get All Vivas:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to fetch vivas"
        });
    }
};


// ======================================================
// 3. GET SINGLE VIVA
// ======================================================

exports.getVivaById = async (req, res) => {
    try {
        const result = await db.query(
            `SELECT
                v.*,
                COALESCE(
                    JSON_AGG(
                        JSON_BUILD_OBJECT(
                            'id', t.id,
                            'topic_name', t.topic_name
                        )
                    ) FILTER (WHERE t.id IS NOT NULL),
                    '[]'
                ) AS topics
             FROM admin_vivas v
             LEFT JOIN admin_viva_topics t
                ON t.viva_id = v.id
             WHERE v.id = $1
             GROUP BY v.id`,
            [req.params.id]
        );

        if (!result.rows.length) {
            return res.status(404).json({
                success: false,
                message: "Viva not found"
            });
        }

        return res.json({
            success: true,
            viva: result.rows[0]
        });

    } catch (error) {
        console.error("Get Viva:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to fetch viva"
        });
    }
};


// ======================================================
// 4. UPDATE VIVA
// ======================================================

exports.updateViva = async (req, res) => {
    const client = await db.connect();

    try {
        const {
            title,
            className,
            subject,
            description,
            topics,
            startDate,
            endDate,
            totalQuestions,
            durationMinutes,
            difficulty,
            attemptLimit
        } = req.body;

        if (
            !title?.trim() ||
            !className ||
            !subject ||
            !Array.isArray(topics) ||
            !topics.length ||
            !startDate ||
            !endDate
        ) {
            return res.status(400).json({
                success: false,
                message: "Complete viva details are required"
            });
        }

        const cleanTopics = [...new Set(
            topics
                .filter(t => typeof t === "string")
                .map(t => t.trim())
                .filter(Boolean)
        )];

        if (
            cleanTopics.length !== topics.length ||
            !cleanTopics.length ||
            new Date(endDate) < new Date(startDate) ||
            !Number.isInteger(Number(totalQuestions)) ||
            Number(totalQuestions) < 1 ||
            Number(totalQuestions) > 50 ||
            !Number.isInteger(Number(durationMinutes)) ||
            Number(durationMinutes) < 1 ||
            !Number.isInteger(Number(attemptLimit)) ||
            Number(attemptLimit) < 1 ||
            !["Easy", "Medium", "Hard", "Mixed"].includes(difficulty)
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid viva settings or topics"
            });
        }

        await client.query("BEGIN");

        const existing = await client.query(
            `SELECT id FROM admin_vivas
             WHERE id = $1 FOR UPDATE`,
            [req.params.id]
        );

        if (!existing.rows.length) {
            await client.query("ROLLBACK");

            return res.status(404).json({
                success: false,
                message: "Viva not found"
            });
        }

        const updated = await client.query(
            `UPDATE admin_vivas
             SET title = $1,
                 class_name = $2,
                 subject = $3,
                 description = $4,
                 start_date = $5,
                 end_date = $6,
                 total_questions = $7,
                 duration_minutes = $8,
                 difficulty = $9,
                 attempt_limit = $10,
                 updated_at = NOW()
             WHERE id = $11
             RETURNING *`,
            [
                title.trim(),
                className,
                subject,
                description || null,
                startDate,
                endDate,
                Number(totalQuestions),
                Number(durationMinutes),
                difficulty,
                Number(attemptLimit),
                req.params.id
            ]
        );

        await client.query(
            `DELETE FROM admin_viva_topics
             WHERE viva_id = $1`,
            [req.params.id]
        );

        for (const topic of cleanTopics) {
            await client.query(
                `INSERT INTO admin_viva_topics
                (viva_id, topic_name)
                VALUES ($1,$2)`,
                [req.params.id, topic]
            );
        }

        await client.query("COMMIT");

        return res.json({
            success: true,
            message: "Viva updated successfully",
            viva: updated.rows[0],
            topics: cleanTopics
        });

    } catch (error) {
        await client.query("ROLLBACK");
        console.error("Update Viva:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to update viva"
        });

    } finally {
        client.release();
    }
};


// ======================================================
// 5. ACTIVATE / DEACTIVATE VIVA
// ======================================================

exports.toggleVivaStatus = async (req, res) => {
    try {
        const { status } = req.body;

        if (!["Active", "Inactive"].includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Status must be Active or Inactive"
            });
        }

        const result = await db.query(
            `UPDATE admin_vivas
             SET status = $1,
                 updated_at = NOW()
             WHERE id = $2
             RETURNING *`,
            [status, req.params.id]
        );

        if (!result.rows.length) {
            return res.status(404).json({
                success: false,
                message: "Viva not found"
            });
        }

        return res.json({
            success: true,
            message: `Viva ${status.toLowerCase()} successfully`,
            viva: result.rows[0]
        });

    } catch (error) {
        console.error("Toggle Viva:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to update viva status"
        });
    }
};


// ======================================================
// 6. DELETE VIVA
// ======================================================

exports.deleteViva = async (req, res) => {
    try {
        const result = await db.query(
            `DELETE FROM admin_vivas v
             WHERE v.id = $1
             AND NOT EXISTS (
                 SELECT 1
                 FROM student_viva_attempts a
                 WHERE a.viva_id = v.id
             )
             RETURNING v.id`,
            [req.params.id]
        );

        if (!result.rows.length) {
            return res.status(409).json({
                success: false,
                message: "Viva not found or students have already attempted it"
            });
        }

        return res.json({
            success: true,
            message: "Viva deleted successfully"
        });

    } catch (error) {
        console.error("Delete Viva:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to delete viva"
        });
    }
};


// ======================================================
// 7. GET STUDENT-WISE RESULTS
// ======================================================

exports.getVivaResults = async (req, res) => {
    try {
        const result = await db.query(
            `SELECT
                a.*,
                s.name AS student_name
             FROM student_viva_attempts a
             LEFT JOIN students s
                ON s.id = a.student_id
             WHERE a.viva_id = $1
             ORDER BY a.started_at DESC`,
            [req.params.id]
        );

        return res.json({
            success: true,
            results: result.rows
        });

    } catch (error) {
        console.error("Viva Results:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to fetch viva results"
        });
    }
};
