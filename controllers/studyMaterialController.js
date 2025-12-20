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
async function uploadStudyMaterial(req, res) {
  const { title, class_name, subject } = req.body;

  if (!title || !class_name || !subject || !req.file) {
    return res.status(400).json({
      success: false,
      message: "All fields are required",
    });
  }

  try {
    const result = await cloudinary.uploader.upload(req.file.path, {
      resource_type: "auto",           // ✅ IMPORTANT
      folder: `study-material/class-${class_name}`,
      use_filename: true,
      unique_filename: false,
      overwrite: true,
    });

    fs.unlinkSync(req.file.path);

    await db.query(
      `INSERT INTO study_material (title, class_name, subject, file_path)
       VALUES (?, ?, ?, ?)`,
      [title, class_name, subject, result.secure_url]
    );

    res.json({
      success: true,
      message: "Uploaded successfully",
      url: result.secure_url,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// ================= GET =================
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

// ================= DELETE =================
async function deleteMaterial(req, res) {
  try {
    const [rows] = await db.query(
      "SELECT file_path FROM study_material WHERE id = ?",
      [req.params.id]
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, message: "Not found" });
    }

    const publicId = rows[0].file_path
      .split("/upload/")[1]
      .split(".")[0];

    await cloudinary.uploader.destroy(publicId, { resource_type: "auto" });
    await db.query("DELETE FROM study_material WHERE id = ?", [req.params.id]);

    res.json({ success: true, message: "Deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  uploadStudyMaterial,
  getMaterialByClass,
  deleteMaterial,
};
