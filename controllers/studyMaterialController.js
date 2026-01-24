const db = require("../db");
const { createClient } = require("@supabase/supabase-js");
const cloudinary = require("cloudinary").v2;

// ================= SUPABASE =================
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// ================= CLOUDINARY (OLD DATA ONLY) =================
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ================= UPLOAD (ONLY SUPABASE) =================
async function uploadStudyMaterial(req, res) {
  const { title, class_name, subject } = req.body;

  if (!title || !class_name || !subject || !req.file) {
    return res.status(400).json({ success: false, message: "Details missing!" });
  }

  try {
    const fileName = `${Date.now()}-${req.file.originalname}`;
    const filePath = `class-${class_name}/${fileName}`;

    // 1️⃣ Upload to Supabase
    const { error } = await supabase.storage
      .from("study-materials")
      .upload(filePath, req.file.buffer, {
        contentType: req.file.mimetype,
      });

    if (error) throw error;

    // 2️⃣ Public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from("study-materials").getPublicUrl(filePath);

    // 3️⃣ Save in DB
    const sql = `
      INSERT INTO study_material 
      (title, class_name, subject, file_path, storage_type)
      VALUES ($1,$2,$3,$4,'supabase')
    `;
    await db.query(sql, [title, class_name, subject, publicUrl]);

    res.json({
      success: true,
      message: "Supabase me upload ho gaya 🔥",
      url: publicUrl,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
}

// ================= FETCH (BOTH CLOUDS) =================
async function getMaterialByClass(req, res) {
  try {
    const sql = `
      SELECT * FROM study_material 
      WHERE class_name = $1 
      ORDER BY uploaded_at DESC
    `;
    const { rows } = await db.query(sql, [req.params.className]);

    res.json({ success: true, materials: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// ================= DELETE (AUTO DETECT CLOUD) =================
async function deleteMaterial(req, res) {
  try {
    const sql = `SELECT file_path, storage_type FROM study_material WHERE id=$1`;
    const { rows } = await db.query(sql, [req.params.id]);

    if (!rows.length) {
      return res.status(404).json({ success: false, message: "Not found" });
    }

    const { file_path, storage_type } = rows[0];

    // 🔴 OLD CLOUDINARY
    if (storage_type === "cloudinary") {
      const publicId = file_path.split("/upload/")[1].split(".")[0];
      await cloudinary.uploader.destroy(publicId, { resource_type: "auto" });
    }

    // 🟢 SUPABASE
    if (storage_type === "supabase") {
      const path = file_path.split("/study-materials/")[1];
      await supabase.storage.from("study-materials").remove([path]);
    }

    await db.query(`DELETE FROM study_material WHERE id=$1`, [req.params.id]);

    res.json({ success: true, message: "Delete successful ✅" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  uploadStudyMaterial,
  getMaterialByClass,
  deleteMaterial,
};
