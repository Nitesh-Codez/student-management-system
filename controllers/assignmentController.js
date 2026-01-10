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
    const { uploader_id, uploader_role, student_id, task_title, subject, class: className, deadline } = req.body;

    // ❌ Required fields check
    if (!uploader_id || !uploader_role || !className || !req.file) {
      return res.status(400).json({ success: false, message: "Required fields missing" });
    }

    // ❌ Extra check for admin: task_title must not be empty
    if (uploader_role === "admin" && !task_title) {
      return res.status(400).json({ success: false, message: "Admin must provide a task title" });
    }

    // Upload to Cloudinary
    const folder = uploader_role === "admin"
      ? `assignments/admin/class-${className}`
      : `assignments/student/class-${className}`;

    const result = await cloudinary.uploader.upload(req.file.path, { resource_type: "auto", folder });
    fs.unlinkSync(req.file.path);

    // DB Insert
    const sql = `
      INSERT INTO assignment_uploads
      (uploader_id, uploader_role, student_id, task_title, subject, class, deadline, file_path, status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING *;
    `;

    const values = [
      uploader_id,
      uploader_role,
      uploader_role === "student" ? student_id : null,      // Student ka id
      uploader_role === "admin" ? task_title : null,        // Admin ka task_title
      subject || null,
      className,
      deadline || null,
      result.secure_url,
      uploader_role === "student" ? "SUBMITTED" : null,    // Student ka status
    ];

    console.log("UPLOAD DATA:", values); // ✅ Debugging: DB me kya ja raha hai

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
        CASE 
          WHEN EXISTS (
            SELECT 1 
            FROM assignment_uploads s
            WHERE s.uploader_role = 'student'
              AND s.student_id = $2
              AND s.class = a.class
              AND s.subject = a.subject
          )
          THEN 'SUBMITTED'
          ELSE 'NOT SUBMITTED'
        END AS status
      FROM assignment_uploads a
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
    const findSql = `SELECT file_path FROM assignment_uploads WHERE id = $1`;
    const { rows } = await db.query(findSql, [id]);

    if (!rows.length) return res.status(404).json({ success: false, message: "Assignment not found" });

    const fileUrl = rows[0].file_path;
    const parts = fileUrl.split("/");
    const fileName = parts.pop().split(".")[0];
    const folder = parts.slice(parts.indexOf("assignments")).join("/");
    const publicId = `${folder}/${fileName}`;

    await cloudinary.uploader.destroy(publicId, { resource_type: "auto" });
    await db.query(`DELETE FROM assignment_uploads WHERE id = $1`, [id]);

    res.json({ success: true, message: "Assignment deleted successfully" });
  } catch (err) {
    console.error("DELETE ERROR:", err.message);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
}

// ================= GET SUBMISSIONS BY TASK =================
async function getSubmissionsByTask(req, res) {
  try {
    const { task_title } = req.params;
    if (!task_title) return res.status(400).json({ success: false, message: "Task title is required" });

    const sql = `
      SELECT a.id, a.task_title, a.subject, a.class, a.file_path, a.status, s.name AS student_name
      FROM assignment_uploads a
      JOIN students s ON a.student_id = s.id
      WHERE a.task_title = $1
      ORDER BY a.uploaded_at DESC
    `;

    const { rows } = await db.query(sql, [task_title]);

    res.json({ success: true, submissions: rows });
  } catch (err) {
    console.error("FETCH SUBMISSIONS ERROR:", err.message);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
}

// ================= EXPORT =================
module.exports = {
  uploadAssignment,
  getAssignmentsByClass,
  getTasksByClass, // added for dropdown
  deleteAssignment,
  getSubmissionsByTask,
};
