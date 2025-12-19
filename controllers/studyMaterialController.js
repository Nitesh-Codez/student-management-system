const db = require("../db");
const fs = require("fs");
const path = require("path");

// ================= UPLOAD =================
async function uploadStudyMaterial(req, res) {
  const { title, class_name, subject } = req.body;

  if (!title || !class_name || !subject || !req.file) {
    return res.status(400).json({
      success: false,
      message: "Title, class, subject and PDF file are required",
    });
  }

  try {
    // 🔥 uploads path fix
    const filePath = req.file.path.replace(/\\/g, "/");

    await db.query(
      `INSERT INTO study_material (title, class_name, subject, file_path)
       VALUES (?, ?, ?, ?)`,
      [title, class_name, subject, filePath]
    );

    res.json({ success: true, message: "Study material uploaded" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// ================= GET BY CLASS =================
async function getMaterialByClass(req, res) {
  try {
    const [rows] = await db.query(
      "SELECT * FROM study_material WHERE class_name = ? ORDER BY uploaded_at DESC",
      [req.params.className]
    );

    res.json({ success: true, materials: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// ================= DOWNLOAD =================
async function downloadMaterial(req, res) {
  try {
    const [rows] = await db.query(
      "SELECT file_path FROM study_material WHERE id = ?",
      [req.params.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "File not found" });
    }

    // 🔥 absolute path correct
    const absolutePath = path.join(process.cwd(), rows[0].file_path);

    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({
        success: false,
        message: "File missing",
        path: absolutePath,
      });
    }

    res.download(absolutePath);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// ================= DELETE =================
async function deleteMaterial(req, res) {
  try {
    const [rows] = await db.query(
      "SELECT file_path FROM study_material WHERE id = ?",
      [req.params.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Material not found" });
    }

    const absolutePath = path.join(process.cwd(), rows[0].file_path);

    await db.query("DELETE FROM study_material WHERE id = ?", [req.params.id]);

    if (fs.existsSync(absolutePath)) {
      fs.unlinkSync(absolutePath);
    }

    res.json({ success: true, message: "Material deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  uploadStudyMaterial,
  getMaterialByClass,
  downloadMaterial,
  deleteMaterial,
};
