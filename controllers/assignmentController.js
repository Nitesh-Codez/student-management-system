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
// ================= UPLOAD ASSIGNMENT =================
async function uploadAssignment(req, res) {
  try {
    const { uploader_id, uploader_role, student_id, task_title, subject, class: className, deadline } = req.body;

    if (!uploader_id || !uploader_role || !className || !req.file) {
      return res.status(400).json({ success: false, message: "Required fields missing" });
    }

    if (uploader_role === "admin" && !task_title) {
      return res.status(400).json({ success: false, message: "Admin must provide a task title" });
    }

    // Upload file to Cloudinary
    const folder = uploader_role === "admin"
      ? `assignments/admin/class-${className}`
      : `assignments/student/class-${className}`;

    const result = await cloudinary.uploader.upload(req.file.path, { resource_type: "auto", folder });
    fs.unlinkSync(req.file.path);

    // ✅ uploaded_at define karna important hai
    const uploadedAt = req.body.uploaded_at || new Date().toISOString();

    // DB Insert
    const sql = `
      INSERT INTO assignment_uploads
      (uploader_id, uploader_role, student_id, task_title, subject, class, deadline, file_path, status, uploaded_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING *;
    `;

    const values = [
      uploader_id,                                      // $1
      uploader_role,                                    // $2
      uploader_role === "student" ? student_id : null, // $3
      task_title,                                       // $4
      subject || null,                                  // $5
      className,                                        // $6
      deadline || null,                                 // $7
      result.secure_url,                                // $8
      uploader_role === "student" ? "SUBMITTED" : null,// $9
      uploadedAt                                        // $10 ✅ uploaded_at timestamp
    ];

    console.log("UPLOAD DATA:", values);

    const { rows } = await db.query(sql, values);

    res.json({ success: true, message: "Assignment uploaded successfully", data: rows[0] });
  } catch (err) {
    console.error("UPLOAD ERROR:", err.message);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
}


// ================= GET ASSIGNMENTS BY CLASS =================
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
        a.file_path AS task_file,          -- ✅ admin task file

        s.id AS student_submission_id,
        s.uploaded_at AS student_uploaded_at,
        s.file_path AS student_file,       -- ✅ ADD THIS LINE
        s.rating,

        CASE 
          WHEN s.id IS NOT NULL THEN 'SUBMITTED'
          ELSE 'NOT SUBMITTED'
        END AS status
      FROM assignment_uploads a
      LEFT JOIN assignment_uploads s
        ON s.task_title = a.task_title
        AND s.uploader_role = 'student'
        AND s.student_id = $2
      WHERE a.uploader_role = 'admin'
        AND a.class = $1
      ORDER BY a.uploaded_at DESC
    `;

    const { rows } = await db.query(sql, [className, studentId]);

    res.json({ success: true, assignments: rows });
  } catch (err) {
    console.error("FETCH ERROR:", err.message);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
}


// ================= GET ADMIN TASKS BY CLASS =================
// ================= GET ADMIN TASKS BY CLASS =================
async function getTasksByClass(req, res) {
  try {
    const { className } = req.params;

    const sql = `
      SELECT 
        task_title,
        deadline,
        MAX(uploaded_at) AS latest_upload
      FROM assignment_uploads
      WHERE uploader_role = 'admin'
        AND class = $1
      GROUP BY task_title, deadline
      ORDER BY latest_upload DESC
    `;

    const { rows } = await db.query(sql, [className]);

    // Return tasks with title and deadline so frontend can distinguish
    res.json({
      success: true,
      tasks: rows.map((r) => ({
        task_title: r.task_title,
        deadline: r.deadline,
      })),
    });
  } catch (err) {
    console.error("FETCH TASKS ERROR:", err.message);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
}

// ================= UPDATE RATING =================
async function updateRating(req, res) {
  try {
    const { id } = req.params; // student submission id
    const { rating } = req.body; // 1 to 5

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: "Rating must be between 1 and 5" });
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
  updateRating,
  getTasksByClass, // added for dropdown
  deleteAssignment,
  getSubmissionsByTask,
};