const db = require("../db");
const cloudinary = require("cloudinary").v2;

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
    // Upload PDF to Cloudinary
    const result = await cloudinary.uploader.upload(req.file.path, {
      resource_type: "raw", // PDF/other files
      folder: `study-material/class-${class_name}`,
      use_filename: true,
      unique_filename: false,
    });

    await db.query(
      `INSERT INTO study_material (title, class_name, subject, file_path)
       VALUES (?, ?, ?, ?)`,
      [title, class_name, subject, result.secure_url] // 🔥 Cloudinary URL
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

    if (rows.length === 0) return res.status(404).json({ success: false, message: "File not found" });

    // Redirect to Cloudinary URL
    res.redirect(rows[0].file_path);
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

    if (rows.length === 0) return res.status(404).json({ success: false, message: "Material not found" });

    // Delete from DB
    await db.query("DELETE FROM study_material WHERE id = ?", [req.params.id]);

    // 🔥 Optional: Delete from Cloudinary
    const publicId = rows[0].file_path
      .split("/")
      .slice(-2)
      .join("/")
      .split(".")[0]; // simple public_id extraction
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
};
