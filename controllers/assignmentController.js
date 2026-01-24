const db = require("../db");
const cloudinary = require("cloudinary").v2;
const { createClient } = require("@supabase/supabase-js");

// ================= CLOUDINARY (OLD DATA ONLY) =================
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ================= SUPABASE (NEW UPLOADS) =================
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ASSIGNMENT_BUCKET = process.env.SUPABASE_ASSIGNMENT_BUCKET;

// ============================================================
// ================= UPLOAD ASSIGNMENT =========================
// ============================================================
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

    const className = req.body.class;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "File missing",
      });
    }

    if (!uploader_id || !uploader_role || !task_title || !subject || !className) {
      return res.status(400).json({
        success: false,
        message: "Required fields missing",
      });
    }

    // 📁 SUPABASE FILE PATH
    const fileName = `${Date.now()}-${req.file.originalname}`;
    const folder =
      uploader_role === "admin"
        ? `admin/class-${className}`
        : `student/class-${className}/${student_id}`;

    const filePath = `${folder}/${fileName}`;

    // ☁️ UPLOAD TO SUPABASE
    const { error } = await supabase.storage
      .from(ASSIGNMENT_BUCKET)
      .upload(filePath, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false,
      });

    if (error) throw error;

    // 🔗 PUBLIC URL
    const {
      data: { publicUrl },
    } = supabase.storage.from(ASSIGNMENT_BUCKET).getPublicUrl(filePath);

    // 🗄️ SAVE IN DB
    const sql = `
      INSERT INTO assignment_uploads
      (
        uploader_id,
        uploader_role,
        student_id,
        task_title,
        subject,
        class,
        deadline,
        file_path,
        status,
        storage_type,
        uploaded_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'supabase',$10)
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
      publicUrl,
      uploader_role === "student" ? "SUBMITTED" : "PENDING",
      new Date(),
    ];

    const { rows } = await db.query(sql, values);

    res.json({
      success: true,
      message: "Assignment uploaded to Supabase ✅",
      data: rows[0],
    });
  } catch (err) {
    console.error("UPLOAD ERROR:", err);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
}

// ============================================================
// ================= DELETE STUDENT SUBMISSION =================
// ============================================================
async function deleteAssignment(req, res) {
  try {
    const { id } = req.params;

    const sql = `
      DELETE FROM assignment_uploads
      WHERE id = $1
        AND uploader_role = 'student'
    `;

    const { rowCount } = await db.query(sql, [id]);

    if (rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Submission not found or not allowed",
      });
    }

    res.json({
      success: true,
      message: "Submission removed successfully",
    });
  } catch (err) {
    console.error("DELETE ERROR:", err.message);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
}

// ============================================================
// ================= GET ASSIGNMENTS BY CLASS ==================
// ============================================================
async function getAssignmentsByClass(req, res) {
  try {
    const { className, studentId } = req.params;

    const sql = `
      SELECT 
        a.id,
        a.task_title,
        a.subject,
        a.class,
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
        AND s.class = a.class
        AND s.uploader_role = 'student'
        AND s.student_id = $2
      WHERE a.uploader_role = 'admin'
        AND a.class = $1
      ORDER BY a.uploaded_at DESC
    `;

    const { rows } = await db.query(sql, [className, studentId]);
    res.json({ success: true, assignments: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// ============================================================
// ================= GET ADMIN TASKS ===========================
// ============================================================
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
        AND class = $1
      GROUP BY task_title, subject, deadline
      ORDER BY latest_upload DESC
    `;

    const { rows } = await db.query(sql, [className]);
    res.json({ success: true, tasks: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// ============================================================
// ================= GET SUBMISSIONS BY TASK ===================
// ============================================================
async function getSubmissionsByTask(req, res) {
  try {
    const { task_title } = req.params;
    const className = req.query.class;

    const sql = `
      SELECT 
        s.id,
        s.task_title,
        s.subject,
        s.class,
        s.file_path,
        s.uploaded_at,
        s.rating,
        a.deadline,
        st.name AS student_name
      FROM assignment_uploads s
      JOIN students st ON s.student_id = st.id
      JOIN assignment_uploads a
        ON a.task_title = s.task_title
       AND a.uploader_role = 'admin'
       AND a.class = s.class
      WHERE s.uploader_role = 'student'
        AND s.task_title = $1
        AND s.class = $2
      ORDER BY s.uploaded_at ASC
    `;

    const { rows } = await db.query(sql, [task_title, className]);
    res.json({ success: true, submissions: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// ============================================================
// ================= UPDATE RATING =============================
// ============================================================
async function updateRating(req, res) {
  try {
    const { id } = req.params;
    const { rating } = req.body;

    const { rows } = await db.query(
      `
      UPDATE assignment_uploads
      SET rating = $1
      WHERE id = $2
        AND uploader_role = 'student'
      RETURNING *;
      `,
      [rating, id]
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: "Submission not found",
      });
    }

    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// ================= EXPORT =================
module.exports = {
  uploadAssignment,
  getAssignmentsByClass,
  updateRating,
  getTasksByClass,
  deleteAssignment,
  getSubmissionsByTask,
};
