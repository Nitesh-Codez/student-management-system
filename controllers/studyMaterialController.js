const db = require("../db");

/* =========================
   ADMIN: UPLOAD MATERIAL
========================= */
exports.uploadMaterial = async (req, res) => {
  const { className: classValue, subject, chapter, adminId } = req.body;
  const fileUrl = req.file ? `/uploads/${req.file.filename}` : null;

  if (!classValue || !subject || !chapter || !fileUrl || !adminId) {
    return res.status(400).json({ success: false, error: "All fields required" });
  }

  try {
    await db.query(
      `INSERT INTO study_materials (class, subject, chapter, file_url, uploaded_by)
       VALUES (?, ?, ?, ?, ?)`,
      [classValue, subject, chapter, fileUrl, adminId]
    );
    res.json({ success: true, message: "Study material uploaded" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

/* =========================
   ADMIN: GET ALL MATERIALS
========================= */
exports.getAllMaterials = async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM study_materials ORDER BY created_at DESC");
    res.json({ success: true, materials: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

/* =========================
   ADMIN: DELETE MATERIAL
========================= */
exports.deleteMaterial = async (req, res) => {
  const { id } = req.params;
  try {
    await db.query(`DELETE FROM study_materials WHERE id = ?`, [id]);
    res.json({ success: true, message: "Material deleted" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

/* =========================
   STUDENT: GET SUBJECTS BY CLASS
========================= */
exports.getSubjectsByClass = async (req, res) => {
  const { class: studentClass } = req.params;
  try {
    const [rows] = await db.query(
      `SELECT DISTINCT subject FROM study_materials WHERE class = ?`,
      [studentClass]
    );
    res.json({ success: true, subjects: rows.map(r => r.subject) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

/* =========================
   STUDENT: GET MATERIAL BY CLASS & SUBJECT
========================= */
exports.getMaterialByClassAndSubject = async (req, res) => {
  const { class: studentClass, subject } = req.params;
  try {
    const [rows] = await db.query(
      `SELECT id, chapter, file_url FROM study_materials WHERE class = ? AND subject = ?`,
      [studentClass, subject]
    );
    res.json({ success: true, materials: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
