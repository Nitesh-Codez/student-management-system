const db = require("../db");
const cloudinary = require("cloudinary").v2;
const fs = require("fs");

// Cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ================= UPLOAD =================
async function uploadAssignment(req, res) {
  const {
    role,
    userId,
    studentId,
    class_name,
    subject,
    task_title,
    task_id,
    deadline,
  } = req.body;

  if (!role || !userId || !class_name || !req.file) {
    return res.status(400).json({
      success: false,
      message: "Required fields missing",
    });
  }

  try {
    // Folder structure
    const folder =
      role === "admin"
        ? `assignments/admin/class-${class_name}`
        : `assignments/students/class-${class_name}`;

    const result = await cloudinary.uploader.upload(req.file.path, {
      resource_type: "auto",
      folder,
      use_filename: true,
      unique_filename: false,
      overwrite: true,
      type: "upload",
    });

    // Delete local file
    fs.unlinkSync(req.file.path);

    // Status calculation for student
    let status = null;
    let studentDeadline = deadline;
    if (role === "student") {
      // If deadline not sent in body, fetch from DB
      if (!deadline && task_id) {
        const sqlDeadline = `SELECT deadline FROM assignment_uploads WHERE id=$1`;
        const { rows } = await db.query(sqlDeadline, [task_id]);
        if (rows.length) studentDeadline = rows[0].deadline;
      }
      const now = new Date();
      status =
        studentDeadline && now <= new Date(studentDeadline) ? "ON_TIME" : "LATE";
    }

    // DB insert
    const sql = `
      INSERT INTO assignment_uploads
      (uploader_id, uploader_role, student_id, task_id, task_title, subject, class, deadline, file_path, status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING *;
    `;

    const values = [
      userId,
      role,
      role === "student" ? studentId : null,
      role === "student" ? task_id : null, // student submission links task_id
      role === "admin" ? task_title : null,
      subject || null,
      class_name,
      role === "admin" ? deadline : studentDeadline || null,
      result.secure_url,
      status,
    ];

    const { rows } = await db.query(sql, values);

    res.json({
      success: true,
      message: "Uploaded successfully",
      assignment: rows[0],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
}

// ================= GET ASSIGNMENTS BY CLASS =================
async function getAssignmentsByClass(req, res) {
  const { className } = req.params;
  try {
    const sql = `
      SELECT a.*, s.name AS student_name
      FROM assignment_uploads a
      LEFT JOIN students s ON a.student_id = s.id
      WHERE a.class = $1
      ORDER BY a.uploaded_at DESC
    `;
    const { rows } = await db.query(sql, [className]);

    if (!rows.length) {
      return res.json({ success: true, assignments: [], message: "No tasks given yet" });
    }

    res.json({ success: true, assignments: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// ================= DELETE ASSIGNMENT =================
async function deleteAssignment(req, res) {
  try {
    const sqlSelect = `SELECT file_path FROM assignment_uploads WHERE id = $1`;
    const { rows } = await db.query(sqlSelect, [req.params.id]);

    if (!rows.length) {
      return res.status(404).json({ success: false, message: "Not found" });
    }

    // Safe public_id extraction
    const url = new URL(rows[0].file_path);
    const pathParts = url.pathname.split("/");
    const fileName = pathParts[pathParts.length - 1].split(".")[0];
    const folder = pathParts.slice(1, pathParts.length - 1).join("/"); // skip first empty part
    const publicId = `${folder}/${fileName}`;

    await cloudinary.uploader.destroy(publicId, { resource_type: "auto" });

    const sqlDelete = `DELETE FROM assignment_uploads WHERE id = $1`;
    await db.query(sqlDelete, [req.params.id]);

    res.json({ success: true, message: "Deleted successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// ================= EXPORT =================
module.exports = {
  uploadAssignment,
  getAssignmentsByClass,
  deleteAssignment,
};
