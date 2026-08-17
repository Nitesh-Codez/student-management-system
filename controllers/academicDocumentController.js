const db = require("../db");
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BUCKET = "assignments";

// ================= UPLOAD EXAM DOCUMENT =================
const uploadExamDocument = async (req, res) => {
  try {
    const {
      exam_type,
      class_name,
      title,
      document_type
    } = req.body;

    if (!req.file || !exam_type || !class_name || !title || !document_type) {
      return res.status(400).json({
        success: false,
        message: "File, exam type, class, title and document type are required"
      });
    }

    // Only PDF + Images
    const allowedTypes = [
      "application/pdf",
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp"
    ];

    if (!allowedTypes.includes(req.file.mimetype)) {
      return res.status(400).json({
        success: false,
        message: "Only PDF, JPG, JPEG, PNG and WEBP files are allowed"
      });
    }

    // Only TIMETABLE / SYLLABUS
    if (!["TIMETABLE", "SYLLABUS"].includes(document_type)) {
      return res.status(400).json({
        success: false,
        message: "Invalid document type"
      });
    }

    const fileName = `${Date.now()}-${req.file.originalname}`;

    const folder = `academic/${document_type.toLowerCase()}/class-${class_name}/${exam_type}`;

    const filePath = `${folder}/${fileName}`;

    // Upload to existing assignments bucket
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(filePath, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false
      });

    if (uploadError) {
      throw uploadError;
    }

    // Public URL
    const { data } = supabase.storage
      .from(BUCKET)
      .getPublicUrl(filePath);

    const publicUrl = data.publicUrl;

    const fileType =
      req.file.mimetype === "application/pdf"
        ? "PDF"
        : "IMAGE";

    // Save DB
    const { rows } = await db.query(
      `INSERT INTO academic_documents
      (
        exam_type,
        class_name,
        title,
        document_type,
        file_path,
        file_type,
        session
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING *`,
      [
        exam_type,
        class_name,
        title,
        document_type,
        publicUrl,
        fileType,
        "2026-27"
      ]
    );

    res.status(201).json({
      success: true,
      message: "Exam document uploaded successfully",
      data: rows[0]
    });

  } catch (error) {
    console.error("UPLOAD EXAM DOCUMENT ERROR:", error);

    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};


// ================= GET EXAM DOCUMENTS =================
const getExamDocuments = async (req, res) => {
  try {
    const {
      exam_type,
      class_name,
      document_type
    } = req.query;

    let query = `
      SELECT *
      FROM academic_documents
      WHERE session = '2026-27'
    `;

    const values = [];
    let index = 1;

    if (exam_type) {
      query += ` AND exam_type = $${index}`;
      values.push(exam_type);
      index++;
    }

    if (class_name) {
      query += ` AND class_name = $${index}`;
      values.push(class_name);
      index++;
    }

    if (document_type) {
      query += ` AND document_type = $${index}`;
      values.push(document_type);
      index++;
    }

    query += ` ORDER BY uploaded_at DESC`;

    const { rows } = await db.query(query, values);

    res.json({
      success: true,
      total: rows.length,
      data: rows
    });

  } catch (error) {
    console.error("GET EXAM DOCUMENTS ERROR:", error);

    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};


// ================= DELETE EXAM DOCUMENT =================
const deleteExamDocument = async (req, res) => {
  try {
    const { id } = req.params;

    const { rows } = await db.query(
      `SELECT file_path FROM academic_documents WHERE id = $1`,
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: "Document not found"
      });
    }

    const fileUrl = rows[0].file_path;

    // Extract storage path from public URL
    const marker = `/storage/v1/object/public/${BUCKET}/`;

    const filePath = fileUrl.includes(marker)
      ? fileUrl.split(marker)[1]
      : null;

    if (filePath) {
      await supabase.storage
        .from(BUCKET)
        .remove([filePath]);
    }

    await db.query(
      `DELETE FROM academic_documents WHERE id = $1`,
      [id]
    );

    res.json({
      success: true,
      message: "Exam document deleted successfully"
    });

  } catch (error) {
    console.error("DELETE EXAM DOCUMENT ERROR:", error);

    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};


module.exports = {
  uploadExamDocument,
  getExamDocuments,
  deleteExamDocument
};