const db = require("../db");
const cloudinary = require("cloudinary").v2;
const fs = require("fs");

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

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
    // Upload PDF to Cloudinary as 'document' so browser can preview
    const result = await cloudinary.uploader.upload(req.file.path, {
      resource_type: "auto", // auto detect type, PDF will be 'document'
      folder: `study-material/class-${class_name}`,
      use_filename: true,
      unique_filename: false,
    });

    // Delete local temp file
    fs.unlinkSync(req.file.path);

    // Insert into DB
    await db.query(
      `INSERT INTO study_material (title, class_name, subject, file_path)
       VALUES (?, ?, ?, ?)`,
      [title, class_name, subject, result.secure_url]
    );

    res.json({ success: true, message: "Study material uploaded", url: result.secure_url });
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

    if (rows.length === 0)
      return res.status(404).json({ success: false, message: "File not found" });

    // Direct download
    res.redirect(rows[0].file_path);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// ================= VIEW =================
async function viewMaterial(req, res) {
  try {
    const [rows] = await db.query(
      "SELECT file_path FROM study_material WHERE id = ?",
      [req.params.id]
    );

    if (rows.length === 0)
      return res.status(404).json({ success: false, message: "File not found" });

    // Directly return Cloudinary URL (auto type, browser preview possible)
    res.json({ success: true, view_url: rows[0].file_path });
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

    if (rows.length === 0)
      return res.status(404).json({ success: false, message: "Material not found" });

    await db.query("DELETE FROM study_material WHERE id = ?", [req.params.id]);

    // Cloudinary delete
    const publicId = rows[0].file_path
      .split("/")
      .slice(-2)
      .join("/")
      .split(".")[0];

    await cloudinary.uploader.destroy(publicId, { resource_type: "raw" });

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
  viewMaterial,
};
