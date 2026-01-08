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

  // ✅ basic validation
  if (!role || !userId || !class_name || !req.file) {
    return res.status(400).json({
      success: false,
      message: "Required fields missing",
    });
  }

  try {
    // ✅ CORRECT folder names (match your structure)
    const folder =
      role === "admin"
        ? `assignments/admin/class-${class_name}`
        : `assignments/student/class-${class_name}`;

    // ✅ upload to cloudinary
    const result = await cloudinary.uploader.upload(req.file.path, {
      resource_type: "auto",
      folder,
    });

    // ✅ SAFE delete local file
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    // ===== student status logic =====
    let status = null;
    let studentDeadline = deadline;

    if (role === "student") {
      if (!deadline && task_id) {
        const { rows } = await db.query(
          "SELECT deadline FROM assignment_uploads WHERE id=$1",
          [task_id]
        );
        if (rows.length) studentDeadline = rows[0].deadline;
      }

      const now = new Date();
      status =
        studentDeadline && now <= new Date(studentDeadline)
          ? "ON_TIME"
          : "LATE";
    }

    // ===== DB insert =====
    const sql = `
      INSERT INTO assignment_uploads
      (uploader_id, uploader_role, student_id, task_id, task_title, subject, class, deadline, file_path, status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING *;
    `;

    const values = [
      userId,
      role,
      role === "student" ? studentId || null : null,
      role === "student" ? task_id || null : null,
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
    console.error("UPLOAD ERROR:", err);
    res.status(500).json({
      success: false,
      message: "Server error while uploading",
    });
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

    res.json({
      success: true,
      assignments: rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
}

// ================= DELETE ASSIGNMENT =================
async function deleteAssignment(req, res) {
  try {
    const { rows } = await db.query(
      "SELECT file_path FROM assignment_uploads WHERE id=$1",
      [req.params.id]
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, message: "Not found" });
    }

    // extract public_id safely
    const url = new URL(rows[0].file_path);
    const parts = url.pathname.split("/");
    const fileName = parts.pop().split(".")[0];
    const folder = parts.slice(1).join("/");
    const publicId = `${folder}/${fileName}`;

    await cloudinary.uploader.destroy(publicId, {
      resource_type: "auto",
    });

    await db.query("DELETE FROM assignment_uploads WHERE id=$1", [
      req.params.id,
    ]);

    res.json({ success: true, message: "Deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
}

// ================= EXPORT =================
module.exports = {
  uploadAssignment,
  getAssignmentsByClass,
  deleteAssignment,
};
