const db = require("../db");
const cloudinary = require("cloudinary").v2;
const fs = require("fs");

// ================= CLOUDINARY CONFIG =================
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ================= UPLOAD ASSIGNMENT =================
async function uploadAssignment(req, res) {
  try {
    const {
      uploader_id,
      uploader_role,
      student_id,
      task_title,
      subject,
      deadline,
    } = req.body;

    const className = req.body.class; // frontend se aata hai

    if (!req.file) {
      return res.status(400).json({ success: false, message: "File not received" });
    }

    // 🔹 normalize class folder
    const normalizedClass = `class-${className}`;

    const folder =
      uploader_role === "admin"
        ? `assignments/admin/${normalizedClass}`
        : `assignments/student/${normalizedClass}`;

    // 🔹 Cloudinary upload
    const result = await cloudinary.uploader.upload(req.file.path, {
      resource_type: "auto",
      folder,
    });

    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);

    // 🔹 INSERT (⚠️ "class" quoted)
    const sql = `
      INSERT INTO assignment_uploads
      (uploader_id, uploader_role, student_id, task_title, subject, "class",
       deadline, file_path, status, uploaded_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING *;
    `;

    const values = [
      uploader_id,
      uploader_role,
      uploader_role === "student" ? student_id : null,
      task_title,
      subject,
      className,
      deadline && deadline !== "null" ? deadline : null,
      result.secure_url,
      uploader_role === "student" ? "SUBMITTED" : "PENDING",
      new Date(),
    ];

    const { rows } = await db.query(sql, values);

    res.json({ success: true, data: rows[0] });
  } catch (err) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    console.error("UPLOAD ERROR:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
}

// ================= GET ASSIGNMENTS BY CLASS (STUDENT VIEW) =================
async function getAssignmentsByClass(req, res) {
  try {
    const { className, studentId } = req.params;

    const sql = `
      SELECT
        a.id,
        a.task_title,
        a.subject,
        a."class",
        a.deadline,
        a.uploaded_at,
        a.file_path AS task_file,

        s.id AS student_submission_id,
        s.uploaded_at AS student_uploaded_at,
        s.file_path AS student_file,
        s.rating,

        CASE
          WHEN s.id IS NOT NULL THEN 'SUBMITTED'
          ELSE 'PENDING'
        END AS status
      FROM assignment_uploads a
      LEFT JOIN assignment_uploads s
        ON s.task_title = a.task_title
        AND s.subject = a.subject
        AND s."class" = a."class"
        AND s.uploader_role = 'student'
        AND s.student_id = $2
      WHERE a.uploader_role = 'admin'
        AND a."class" = $1
      ORDER BY a.uploaded_at DESC;
    `;

    const { rows } = await db.query(sql, [className, studentId]);

    res.json({ success: true, assignments: rows });
  } catch (err) {
    console.error("FETCH ASSIGNMENTS ERROR:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
}

// ================= GET ADMIN TASKS BY CLASS =================
async function getTasksByClass(req, res) {
  try {
    const { className } = req.params;

    const sql = `
      SELECT
        task_title,
        subject,
        deadline,
        MAX(uploaded_at) AS latest_upload
      FROM assignment_uploads
      WHERE uploader_role = 'admin'
        AND "class" = $1
      GROUP BY task_title, subject, deadline
      ORDER BY latest_upload DESC;
    `;

    const { rows } = await db.query(sql, [className]);

    res.json({
      success: true,
      tasks: rows.map((r) => ({
        task_title: r.task_title,
        subject: r.subject,
        deadline: r.deadline,
      })),
    });
  } catch (err) {
    console.error("FETCH TASKS ERROR:", err.message);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
}

// ================= DELETE STUDENT SUBMISSION =================
async function deleteAssignment(req, res) {
  try {
    const { id } = req.params;

    const { rowCount } = await db.query(
      `
      DELETE FROM assignment_uploads
      WHERE id = $1 AND uploader_role = 'student';
      `,
      [id]
    );

    if (!rowCount) {
      return res.status(404).json({
        success: false,
        message: "Submission not found or not allowed",
      });
    }

    res.json({ success: true, message: "Submission deleted successfully" });
  } catch (err) {
    console.error("DELETE ERROR:", err.message);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
}

// ================= GET SUBMISSIONS BY TASK (ADMIN) =================
async function getSubmissionsByTask(req, res) {
  try {
    const { task_title } = req.params;
    const className = req.query.class;

    const sql = `
      SELECT
        s.id,
        s.task_title,
        s.subject,
        s."class",
        s.file_path,
        s.uploaded_at,
        s.rating,
        a.deadline,
        st.name AS student_name,
        CASE
          WHEN s.rating IS NOT NULL THEN 'GRADED'
          ELSE 'NOT GRADED'
        END AS grading_status
      FROM assignment_uploads s
      JOIN students st ON s.student_id = st.id
      JOIN assignment_uploads a
        ON a.task_title = s.task_title
       AND a.subject = s.subject
       AND a.uploader_role = 'admin'
       AND a."class" = s."class"
      WHERE s.uploader_role = 'student'
        AND s.task_title = $1
        AND s."class" = $2
      ORDER BY s.uploaded_at ASC;
    `;

    const { rows } = await db.query(sql, [task_title, className]);

    res.json({ success: true, submissions: rows });
  } catch (err) {
    console.error("FETCH SUBMISSIONS ERROR:", err.message);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
}

// ================= UPDATE RATING =================
async function updateRating(req, res) {
  try {
    const { id } = req.params;
    const { rating } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res
        .status(400)
        .json({ success: false, message: "Rating must be between 1 and 5" });
    }

    const sql = `
      UPDATE assignment_uploads
      SET rating = $1
      WHERE id = $2 AND uploader_role = 'student'
      RETURNING *;
    `;

    const { rows } = await db.query(sql, [rating, id]);

    if (!rows.length) {
      return res.status(404).json({ success: false, message: "Submission not found" });
    }

    res.json({ success: true, message: "Rating updated", data: rows[0] });
  } catch (err) {
    console.error("UPDATE RATING ERROR:", err.message);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
}

// ================= EXPORT =================
module.exports = {
  uploadAssignment,
  getAssignmentsByClass,
  getTasksByClass,
  deleteAssignment,
  getSubmissionsByTask,
  updateRating,
};
