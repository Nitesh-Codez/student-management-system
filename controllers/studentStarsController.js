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

    const {
      student_id,
      class_name,
      session,
      stars,
      remarks
    } = req.body;

    await db.query(
      `
      INSERT INTO student_stars
      (student_id,class_name,session,stars,remarks)

      VALUES($1,$2,$3,$4,$5)

      ON CONFLICT(student_id,class_name,session)

      DO UPDATE SET

      stars=EXCLUDED.stars,
      remarks=EXCLUDED.remarks,
      updated_at=NOW()
      `,
      [
        student_id,
        class_name,
        session,
        stars,
        remarks
      ]
    );

    res.json({
      success:true,
      message:"Stars Saved Successfully"
    });

  } catch(err){

    console.log(err);

    res.status(500).json({
      success:false,
      message:err.message
    });

  }
};

// ================= TREE LEADERBOARD =================
exports.getLeaderboard = async (req,res)=>{

 try{

  const {class:className,session}=req.query;

  const result=await db.query(

   `
   SELECT
   s.id,
   s.name,
   s.profile_photo,
   ss.stars,
   ss.remarks

   FROM student_stars ss

   JOIN students s
   ON s.id=ss.student_id

   WHERE
   ss.class_name=$1
   AND ss.session=$2

   ORDER BY ss.stars DESC,s.name
   `,
   [className,session]

  );

  res.json({
   success:true,
   leaderboard:result.rows
  });

 }catch(err){

  res.status(500).json({
   success:false,
   message:err.message
  });

 }

};



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
          ss.stars,
          RANK() OVER(
            PARTITION BY ss.class_name
            ORDER BY ss.stars DESC
          ) AS rank
        FROM student_stars ss
        JOIN students s
        ON s.id = ss.student_id
        WHERE ss.session = $1
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
          ss.stars,
          RANK() OVER(
            PARTITION BY ss.class_name
            ORDER BY ss.stars DESC
          ) AS rank
        FROM student_stars ss
        JOIN students s
        ON s.id = ss.student_id
        WHERE ss.session = $1
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
        ss.stars,
        ss.remarks
      FROM student_stars ss
      JOIN students s
      ON s.id = ss.student_id
      WHERE ss.class_name = $1
      AND ss.session = $2
      ORDER BY ss.stars DESC, s.name
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