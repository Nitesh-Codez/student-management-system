const db = require("../db");
const { createClient } = require('@supabase/supabase-js');
const cloudinary = require("cloudinary").v2;

// ✅ Supabase Initialize
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

// Cloudinary Config (Sirf purani files delete karne ke liye)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ================= UPLOAD (With Automatic Folder Creation) =================
async function uploadStudyMaterial(req, res) {
  const { title, class_name, subject } = req.body;

  if (!title || !class_name || !subject || !req.file) {
    return res.status(400).json({ success: false, message: "Bhai, details missing hain!" });
  }

  try {
    const fileName = `${Date.now()}-${req.file.originalname}`;
    // ✅ Folder path set kiya: class-10/filename.pdf
    const filePath = `class-${class_name}/${fileName}`;

    // 1. Supabase Storage mein folder ke saath upload
    const { data, error } = await supabase.storage
      .from('study-materials')
      .upload(filePath, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false
      });

    if (error) throw error;

    // 2. Folder wala Public URL lo
    const { data: { publicUrl } } = supabase.storage
      .from('study-materials')
      .getPublicUrl(filePath);

    // 3. Database mein link save karo
    const sql = `
      INSERT INTO study_material (title, class_name, subject, file_path)
      VALUES ($1, $2, $3, $4)
    `;
    await db.query(sql, [title, class_name, subject, publicUrl]);

    res.json({
      success: true,
      message: `Mast! Class ${class_name} ke folder mein upload ho gaya.`,
      url: publicUrl,
    });
  } catch (err) {
    console.error("Supabase Error:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
}

// ================= GET (No Change) =================
async function getMaterialByClass(req, res) {
  try {
    const sql = `SELECT * FROM study_material WHERE class_name = $1 ORDER BY uploaded_at DESC`;
    const { rows } = await db.query(sql, [req.params.className]);
    res.json({ success: true, materials: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// ================= DELETE (Supabase Folder Support) =================
async function deleteMaterial(req, res) {
  try {
    const sqlSelect = `SELECT file_path FROM study_material WHERE id = $1`;
    const { rows } = await db.query(sqlSelect, [req.params.id]);

    if (!rows.length) return res.status(404).json({ success: false, message: "Not found" });

    const fullUrl = rows[0].file_path;

    // 1. Storage se file delete karo
    if (fullUrl.includes("cloudinary.com")) {
      const publicId = fullUrl.split("/upload/")[1].split(".")[0];
      await cloudinary.uploader.destroy(publicId, { resource_type: "auto" });
    } else {
      // Supabase ka path nikaalo (bucket name ke baad ka hissa)
      // Link aisa hota hai: .../storage/v1/object/public/study-materials/class-10/file.pdf
      const pathParts = fullUrl.split('/study-materials/');
      if (pathParts.length > 1) {
        const storagePath = pathParts[1];
        await supabase.storage.from('study-materials').remove([storagePath]);
      }
    }

    // 2. Database se row delete karo
    const sqlDelete = `DELETE FROM study_material WHERE id = $1`;
    await db.query(sqlDelete, [req.params.id]);

    res.json({ success: true, message: "File aur Record dono delete ho gaye!" });
  } catch (err) {
    console.error("Delete Error:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = { uploadStudyMaterial, getMaterialByClass, deleteMaterial };