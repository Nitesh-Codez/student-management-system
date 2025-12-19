const db = require("../db");
const fs = require("fs");
const path = require("path");

// ================= UPLOAD STUDY MATERIAL =================
async function uploadStudyMaterial(req, res) {
  const { title, class_name, subject } = req.body;

  if (!title || !class_name || !subject || !req.file) {
    return res.status(400).json({
      success: false,
      message: "Title, class, subject and PDF file are required",
    });
  }

  try {
    const filePath = req.file.path.replace(/\\/g, "/");

    const sql = `
      INSERT INTO study_material (title, class_name, subject, file_path)
      VALUES (?, ?, ?, ?)
    `;

    await db.query(sql, [title, class_name, subject, filePath]);

    res.json({
      success: true,
      message: "Study material uploaded successfully",
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// ================= GET MATERIAL BY CLASS =================
async function getMaterialByClass(req, res) {
  const className = req.params.className;

  try {
    const sql = `
      SELECT * FROM study_material
      WHERE class_name = ?
      ORDER BY uploaded_at DESC
    `;

    const [rows] = await db.query(sql, [className]);

    res.json({ success: true, materials: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// ================= DELETE MATERIAL =================
async function deleteMaterial(req, res) {
  const materialId = req.params.id;

  try {
    // get file path
    const [rows] = await db.query(
      "SELECT file_path FROM study_material WHERE id = ?",
      [materialId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Material not found",
      });
    }

    const filePath = rows[0].file_path;

    // delete DB record
    await db.query("DELETE FROM study_material WHERE id = ?", [materialId]);

    // delete file from storage
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    res.json({
      success: true,
      message: "Study material deleted successfully",
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  uploadStudyMaterial,
  getMaterialByClass,
  deleteMaterial,
};
