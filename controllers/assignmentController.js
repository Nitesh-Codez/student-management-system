const db = require("../db");
const cloudinary = require("cloudinary").v2;
const fs = require("fs");

/* ================= CLOUDINARY ================= */
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/* ================= ADMIN / STUDENT UPLOAD ================= */
async function uploadAssignment(req, res) {
  try {
    const {
      userId,          // 👈 frontend se
      role,            // 👈 frontend se
      student_id,
      task_title,
      subject,
      class_name,      // 👈 frontend se
      deadline,
    } = req.body;

    if (!userId || !role || !class_name || !req.file) {
      return res.status(400).json({
        success: false,
        message: "Required fields missing",
      });
    }

    const folder =
      role === "admin"
        ? `assignments/admin/class-${class_name}`
        : `assignments/student/class-${class_name}`;

    const result = await cloudinary.uploader.upload(req.file.path, {
      resource_type: "auto",
      folder,
    });

    fs.unlinkSync(req.file.path);

    const sql = `
      INSERT INTO assignment_uploads
      (uploader_id, uploader_role, student_id, task_title, subject, class, deadline, file_path, status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING *;
    `;

    const values = [
      userId,
      role,
      role === "student" ? userId : null,
      role === "admin" ? task_title : null,
      subject || null,
      class_name,
      deadline || null,
      result.secure_url,
      role === "student" ? "SUBMITTED" : "ACTIVE",
    ];

    const { rows } = await db.query(sql, values);

    res.json({
      success: true,
      message: "Uploaded successfully",
      data: rows[0],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
}

/* ================= GET TASKS (ADMIN) ================= */
async function getAllAssignments(req, res) {
  try {
    const { rows } = await db.query(
      "SELECT * FROM assignment_uploads ORDER BY uploaded_at DESC"
    );

    res.json({ success: true, assignments: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: "DB error" });
  }
}

/* ================= STUDENT SUBMIT ================= */
async function submitAssignment(req, res) {
  try {
    const { assignment_id, student_id } = req.body;
    if (!assignment_id || !student_id || !req.file) {
      return res.status(400).json({ success: false, message: "Missing data" });
    }

    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: "assignments/student/submissions",
      resource_type: "auto",
    });

    fs.unlinkSync(req.file.path);

    await db.query(
      `INSERT INTO assignment_submissions
       (assignment_id, student_id, file_path)
       VALUES ($1,$2,$3)`,
      [assignment_id, student_id, result.secure_url]
    );

    res.json({ success: true, message: "Submitted successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Submit failed" });
  }
}

/* ================= VIEW SUBMISSIONS (ADMIN) ================= */
async function getSubmissions(req, res) {
  try {
    const { assignmentId } = req.params;

    const { rows } = await db.query(
      `SELECT * FROM assignment_submissions
       WHERE assignment_id = $1
       ORDER BY submitted_at DESC`,
      [assignmentId]
    );

    res.json({ success: true, submissions: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: "DB error" });
  }
}

/* ================= DELETE ================= */
async function deleteAssignment(req, res) {
  try {
    const { id } = req.params;
    await db.query("DELETE FROM assignment_uploads WHERE id=$1", [id]);
    res.json({ success: true, message: "Deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Delete failed" });
  }
}

module.exports = {
  uploadAssignment,
  getAllAssignments,
  submitAssignment,
  getSubmissions,
  deleteAssignment,
};
