const db = require("../db");
const cloudinary = require("cloudinary").v2;
const { createClient } = require("@supabase/supabase-js");

// ================= CLOUDINARY (LEGACY / OLD DATA ONLY) =================
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ================= SUPABASE =================
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// 🔒 fallback bucket
const ASSIGNMENT_BUCKET =
  process.env.SUPABASE_ASSIGNMENT_BUCKET || "assignments";

// ============================================================
// ================= UPLOAD ASSIGNMENT =========================
// ============================================================
async function uploadAssignment(req, res) {
  try {
    const {
      uploader_id,
      uploader_role,
      task_title,
      subject,
      deadline,
    } = req.body;

    const className = req.body.class;

    if (
      !req.file ||
      !uploader_id ||
      !uploader_role ||
      !task_title ||
      !subject ||
      !className
    ) {
      return res.status(400).json({
        success: false,
        message: "Required fields missing",
      });
    }

    if (uploader_role === "admin" && !deadline) {
      return res.status(400).json({
        success: false,
        message: "Deadline required for admin",
      });
    }

    // ================= SESSION =================
    let session = null;

    // 🔹 Student → session students table se
    if (uploader_role === "student") {
      const { rows } = await db.query(
        "SELECT session FROM students WHERE id=$1",
        [uploader_id]
      );

      if (!rows.length) {
        return res.status(404).json({
          success: false,
          message: "Student not found",
        });
      }

      session = rows[0].session;
    }

    // 🔹 Admin → hardcoded session
    if (uploader_role === "admin") {
      session = "2026-27";
    }

    // ================= FILE PATH =================
    const fileName = `${Date.now()}-${req.file.originalname}`;

    const folder =
      uploader_role === "admin"
        ? `assignments/admin/class-${className}`
        : `assignments/student/class-${className}`;

    const filePath = `${folder}/${fileName}`;

    // ================= UPLOAD TO SUPABASE =================
    const { error: uploadError } = await supabase.storage
      .from(ASSIGNMENT_BUCKET)
      .upload(filePath, req.file.buffer, {
        contentType: req.file.mimetype,
      });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage
      .from(ASSIGNMENT_BUCKET)
      .getPublicUrl(filePath);

    const publicUrl = data.publicUrl;

    // ================= INSERT DB =================
    const sql = `
      INSERT INTO assignment_uploads
      (
        uploader_id,
        uploader_role,
        student_id,
        task_title,
        subject,
        class,
        deadline,
        file_path,
        status,
        storage_type,
        uploaded_at,
        session
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      RETURNING *;
    `;

    const values = [
      uploader_id,
      uploader_role,
      uploader_role === "student" ? uploader_id : null,
      task_title,
      subject,
      className,
      uploader_role === "admin" ? deadline : null,
      publicUrl,
      uploader_role === "student" ? "SUBMITTED" : null,
      "supabase",
      new Date(),
      session,
    ];

    const { rows } = await db.query(sql, values);

    res.json({
      success: true,
      message: "Assignment uploaded successfully ✅",
      data: rows[0],
    });

  } catch (err) {
    console.error("UPLOAD ERROR:", err);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
}
// ============================================================
// ================= DELETE STUDENT SUBMISSION =================
// ============================================================
async function deleteAssignment(req, res) {
  try {
    const { id } = req.params;

    const { rows } = await db.query(
      `SELECT file_path FROM assignment_uploads 
       WHERE id=$1 AND uploader_role='student'`,
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, message: "Submission not found" });
    }

    const publicUrl = rows[0].file_path;

    // ✅ SAFE PATH EXTRACTION
    const url = new URL(publicUrl);
    const fullPath = url.pathname; 
    // /storage/v1/object/public/assignments/student/class-10th/34/file.pdf

    const filePath = fullPath.replace(
      `/storage/v1/object/public/${ASSIGNMENT_BUCKET}/`,
      ""
    );

    if (filePath) {
      await supabase.storage
        .from(ASSIGNMENT_BUCKET)
        .remove([filePath]);
    }

    await db.query(`DELETE FROM assignment_uploads WHERE id=$1`, [id]);

    res.json({ success: true, message: "Submission deleted successfully ✅" });

  } catch (err) {
    console.error("DELETE ERROR:", err);
    res.status(500).json({ success: false, message: err.message });
  }
}


// ============================================================
// ================= GET ASSIGNMENTS BY CLASS ==================
// ============================================================
async function getAssignmentsByClass(req, res) {
  try {
    const { className, studentId } = req.params;

    const sql = `
      SELECT 
        a.id,
        a.task_title,
        a.subject,
        a.class,
        a.deadline,
        a.uploaded_at,
        a.file_path AS task_file,

        s.id AS student_submission_id,
        s.uploaded_at AS student_uploaded_at,
        s.file_path AS student_file,
        s.rating,

        CASE
          WHEN s.id IS NOT NULL THEN 'SUBMITTED'
          ELSE 'PENDING'
        END AS status

      FROM assignment_uploads a

      JOIN students st
        ON st.id = $2

      LEFT JOIN assignment_uploads s
        ON s.task_title = a.task_title
       AND s.class = a.class
       AND s.uploader_role = 'student'
       AND s.student_id = $2

      WHERE a.uploader_role = 'admin'
        AND a.class = $1
        AND a.session = st.session   -- ✅ YEH IMPORTANT LINE

      ORDER BY a.uploaded_at DESC
    `;

    const { rows } = await db.query(sql, [className, studentId]);

    res.json({ success: true, assignments: rows });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
}
// ============================================================
// ================= GET ADMIN TASKS ===========================
// ============================================================
async function getTasksByClass(req, res) {
  try {
    const { className } = req.params;

    const { rows } = await db.query(
      `
      SELECT 
        task_title,
        subject,
        deadline,
        MAX(uploaded_at) AS latest_upload
      FROM assignment_uploads
      WHERE uploader_role='admin'
        AND class=$1
      GROUP BY task_title, subject, deadline
      ORDER BY latest_upload DESC
      `,
      [className]
    );

    res.json({ success: true, tasks: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// ============================================================
// ================= GET SUBMISSIONS BY TASK ===================
// ============================================================
async function getSubmissionsByTask(req, res) {
  try {
    const { task_title } = req.params;
    const className = req.query.class;

    const { rows } = await db.query(
      `
      SELECT
        s.id,
        s.task_title,
        s.subject,
        s.class,
        s.file_path,
        s.uploaded_at,
        s.rating,
        a.deadline,
        st.name AS student_name

      FROM assignment_uploads s
      JOIN students st ON st.id = s.student_id
      JOIN assignment_uploads a
        ON a.task_title = s.task_title
       AND a.uploader_role = 'admin'
       AND a.class = s.class

      WHERE s.uploader_role='student'
        AND s.task_title=$1
        AND s.class=$2

      ORDER BY s.uploaded_at ASC
      `,
      [task_title, className]
    );

    res.json({ success: true, submissions: rows });

  } catch (err) {
    console.error("ERROR:", err);
    res.status(500).json({ success: false, message: err.message });
  }
}
// ============================================================
// ================= UPDATE RATING =============================
// ============================================================
async function updateRating(req, res) {
  try {
    const { id } = req.params;
    const { rating } = req.body;

    if (rating < 0 || rating > 10) {
      return res
        .status(400)
        .json({ success: false, message: "Rating must be between 0–10" });
    }

    const { rows } = await db.query(
      `
      UPDATE assignment_uploads
      SET rating=$1
      WHERE id=$2 AND uploader_role='student'
      RETURNING *;
      `,
      [rating, id]
    );

    if (!rows.length) {
      return res
        .status(404)
        .json({ success: false, message: "Submission not found" });
    }

    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

//==============EDIT=====================


// ================= EDIT ADMIN ASSIGNMENT =================
async function editAssignment(req, res) {
  try {
    const { id } = req.params;
    const { task_title, subject, class: className, deadline } = req.body;

    // 1. Existing assignment fetch
    const { rows } = await db.query(
      `SELECT * FROM assignment_uploads
       WHERE id = $1 AND uploader_role = 'admin'`,
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: "Assignment not found"
      });
    }

    const old = rows[0];

    // 2. Existing values retain, new values update
    let filePath = old.file_path;
    let storageType = old.storage_type;

    // 3. New PDF upload (if provided)
    if (req.file) {
      const newFileName =
        `${Date.now()}-${req.file.originalname}`;

      const folder = `assignments/admin/class-${className || old.class}`;
      const newPath = `${folder}/${newFileName}`;

      const { error } = await supabase.storage
        .from(ASSIGNMENT_BUCKET)
        .upload(newPath, req.file.buffer, {
          contentType: req.file.mimetype
        });

      if (error) throw error;

      const { data } = supabase.storage
        .from(ASSIGNMENT_BUCKET)
        .getPublicUrl(newPath);

      filePath = data.publicUrl;
      storageType = "supabase";
    }

    // 4. Update assignment details
    const { rows: updated } = await db.query(
      `UPDATE assignment_uploads
       SET task_title = $1,
           subject = $2,
           class = $3,
           deadline = $4,
           file_path = $5,
           storage_type = $6
       WHERE id = $7
       RETURNING *`,
      [
        task_title ?? old.task_title,
        subject ?? old.subject,
        className ?? old.class,
        deadline ?? old.deadline,
        filePath,
        storageType,
        id
      ]
    );

    // 5. Remove old PDF after successful update
    if (req.file && old.storage_type === "supabase" && old.file_path) {
      try {
        const marker =
          `/storage/v1/object/public/${ASSIGNMENT_BUCKET}/`;

        const objectPath = old.file_path.split(marker)[1];

        if (objectPath) {
          await supabase.storage
            .from(ASSIGNMENT_BUCKET)
            .remove([objectPath]);
        }
      } catch (deleteError) {
        console.error("Old PDF deletion error:", deleteError);
      }
    }

    res.json({
      success: true,
      message: "Assignment updated successfully",
      data: updated[0]
    });

  } catch (err) {
    console.error("EDIT ASSIGNMENT ERROR:", err);

    res.status(500).json({
      success: false,
      message: err.message
    });
  }
}

// ================= EXPORT =================
module.exports = {
  uploadAssignment,
  deleteAssignment,
  getAssignmentsByClass,
  getTasksByClass,
  updateAdminAssignment,
  getSubmissionsByTask,
  updateRating,
};
