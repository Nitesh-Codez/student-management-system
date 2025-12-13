import db from "../config/db.js";

/* =========================
   ADMIN: UPLOAD MATERIAL
========================= */
export const uploadMaterial = async (req, res) => {
  const { className, subject, chapter, fileUrl, adminId } = req.body;

  try {
    await db.query(
      `INSERT INTO study_materials (class, subject, chapter, file_url, uploaded_by)
       VALUES (?, ?, ?, ?, ?)`,
      [className, subject, chapter, fileUrl, adminId]
    );

    res.json({ success: true, message: "Study material uploaded" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

/* =========================
   STUDENT: GET SUBJECTS
========================= */
export const getSubjectsByClass = async (req, res) => {
  const { class: studentClass } = req.params;

  try {
    const [rows] = await db.query(
      `SELECT DISTINCT subject FROM study_materials WHERE class = ?`,
      [studentClass]
    );

    res.json({
      success: true,
      subjects: rows.map(r => r.subject)
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

/* =========================
   STUDENT: GET CHAPTERS
========================= */
export const getMaterialByClassAndSubject = async (req, res) => {
  const { class: studentClass, subject } = req.params;

  try {
    const [rows] = await db.query(
      `SELECT id, chapter, file_url 
       FROM study_materials 
       WHERE class = ? AND subject = ?`,
      [studentClass, subject]
    );

    res.json({ success: true, materials: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

/* =========================
   ADMIN: DELETE MATERIAL
========================= */
export const deleteMaterial = async (req, res) => {
  const { id } = req.params;

  try {
    await db.query(
      `DELETE FROM study_materials WHERE id = ?`,
      [id]
    );

    res.json({ success: true, message: "Material deleted" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
