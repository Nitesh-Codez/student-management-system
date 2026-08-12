const db = require("../db");

// ================= GET STUDENTS BY CLASS =================
exports.getStudentsByClass = async (req, res) => {
  try {
    const { class: className, session } = req.query;

    const sql = `
      SELECT
        s.id,
        s.name,
        s."class",
        s.profile_photo,
        COALESCE(ss.stars,0) AS stars,
        COALESCE(ss.remarks,'') AS remarks
      FROM students s
      LEFT JOIN student_stars ss
      ON s.id = ss.student_id
      AND ss.session = $2
      WHERE s."class" = $1
      AND s.role='student'
      ORDER BY s.name;
    `;

    const { rows } = await db.query(sql, [className, session]);

    res.json({
      success: true,
      students: rows
    });

  } catch (err) {
    console.log(err);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

// ================= SAVE / UPDATE STARS =================
exports.saveStudentStars = async (req, res) => {
  try {
    const { student_id, class_name, session, stars, remarks } = req.body;

    await db.query(
      `
      INSERT INTO student_stars (student_id, class_name, session, stars, remarks)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (student_id, class_name, session)
      DO UPDATE SET
        stars = EXCLUDED.stars,
        remarks = EXCLUDED.remarks,
        updated_at = NOW()
      `,
      [student_id, class_name, session, stars, remarks]
    );

    res.json({
      success: true,
      message: "Stars Saved Successfully"
    });

  } catch (err) {
    console.log(err);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

// ================= TREE LEADERBOARD =================
exports.getLeaderboard = async (req, res) => {
  try {
    const { class: className, session } = req.query;

    let sql = `
      SELECT
        ss.id,
        ss.student_id,
        ss.class_name,
        ss.session,
        COALESCE(ss.stars, 0) AS stars,
        COALESCE(ss.remarks, '') AS remarks,
        s.name,
        s.profile_photo
      FROM student_stars ss
      JOIN students s
        ON s.id = ss.student_id
    `;

    const conditions = [];
    const values = [];

    if (className) {
      values.push(className);
      conditions.push(`ss.class_name = $${values.length}`);
    }

    if (session) {
      values.push(session);
      conditions.push(`ss.session = $${values.length}`);
    }

    if (conditions.length > 0) {
      sql += ` WHERE ` + conditions.join(" AND ");
    }

    sql += `
      ORDER BY
        ss.stars DESC,
        s.name ASC
    `;

    const result = await db.query(sql, values);

    res.json({
      success: true,
      total: result.rows.length,
      leaderboard: result.rows
    });

  } catch (err) {
    console.error("Leaderboard Error:", err);

    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};
// ================= GET MY RANK =================
exports.getMyRank = async (req, res) => {
  try {
    const { student_id, session } = req.query;

    const result = await db.query(
      `
      SELECT *
      FROM (
        SELECT
          s.id,
          s.name,
          s.profile_photo,
          COALESCE(ss.stars, 0) AS stars,
          RANK() OVER(
            PARTITION BY s."class"
            ORDER BY COALESCE(ss.stars, 0) DESC
          ) AS rank
        FROM students s
        LEFT JOIN student_stars ss
        ON s.id = ss.student_id AND ss.session = $1
        WHERE s.role = 'student'
      ) t
      WHERE id = $2
      `,
      [session, student_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No ranking found"
      });
    }

    res.json({
      success: true,
      student: result.rows[0]
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

// ================= GET MY TREE =================
exports.getMyTree = async (req, res) => {
  try {
    const { student_id, session } = req.query;

    const student = await db.query(
      `SELECT "class" FROM students WHERE id = $1`,
      [student_id]
    );

    if (student.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Student not found"
      });
    }

    const className = student.rows[0].class;

    const result = await db.query(
      `
      SELECT
        s.id,
        s.name,
        s.profile_photo,
        COALESCE(ss.stars, 0) AS stars,
        COALESCE(ss.remarks, '') AS remarks
      FROM students s
      LEFT JOIN student_stars ss
      ON s.id = ss.student_id AND ss.session = $2
      WHERE s."class" = $1 AND s.role = 'student'
      ORDER BY stars DESC, s.name ASC
      `,
      [className, session]
    );

    res.json({
      success: true,
      students: result.rows
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};



//Admin
// ================= ADMIN: GET ALL STUDENTS WITH STARS =================
exports.getAllStudentsWithStars = async (req, res) => {
  try {
    const { session } = req.query;

    const result = await db.query(
      `
      SELECT
        s.id,
        s.name,
        s."class",
        s.profile_photo,
        COALESCE(ss.stars, 0) AS stars,
        COALESCE(ss.remarks, '') AS remarks,
        ss.id AS star_record_id
      FROM students s
      LEFT JOIN student_stars ss
        ON s.id = ss.student_id
        AND ss.session = $1
      WHERE s.role = 'student'
      ORDER BY
        s."class" ASC,
        s.name ASC
      `,
      [session]
    );

    res.json({
      success: true,
      total: result.rows.length,
      students: result.rows
    });

  } catch (err) {
    console.error("Get All Students With Stars Error:", err);

    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};