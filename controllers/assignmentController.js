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
async function getTasksByClass(req, res) {
  try {
    const { className } = req.params;
    const sql = `
      SELECT task_title
FROM assignment_uploads
WHERE class = $1 AND uploader_role = 'admin'
GROUP BY task_title
ORDER BY MAX(uploaded_at) DESC

    `;
    const { rows } = await db.query(sql, [className]);
    res.json({ success: true, tasks: rows }); // rows = [{ task_title: 'Task 2' }, ...]
  } catch (err) {
    console.error("FETCH TASKS ERROR:", err.message);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
}

// ================= DELETE ASSIGNMENT =================
async function deleteAssignment(req, res) {
  try {
    const { id } = req.params;

    // 1️⃣ Get public_id from DB
    const findSql = `
      SELECT public_id 
      FROM assignment_uploads 
      WHERE id = $1
    `;
    const { rows } = await db.query(findSql, [id]);

    if (!rows.length) {
      return res
        .status(404)
        .json({ success: false, message: "Assignment not found" });
    }

    const publicId = rows[0].public_id;

    // 2️⃣ Delete from Cloudinary
    if (publicId) {
      await cloudinary.uploader.destroy(publicId, {
        resource_type: "auto",
      });
    }

    // 3️⃣ Delete DB record
    await db.query(
      `DELETE FROM assignment_uploads WHERE id = $1`,
      [id]
    );

    res.json({
      success: true,
      message: "Assignment deleted successfully",
    });
  } catch (err) {
    console.error("DELETE ERROR:", err);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
}

// ================= GET SUBMISSIONS BY TASK =================
async function getSubmissionsByTask(req, res) {
  try {
    const { task_title } = req.params;
    const className = req.query.class; // ✅ class filter

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
        st.name AS student_name,
        CASE
          WHEN s.rating IS NOT NULL THEN 'GRADED'
          ELSE 'NOT GRADED'
        END AS grading_status
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
    console.error("FETCH SUBMISSIONS ERROR:", err.message);
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