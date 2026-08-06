const bcrypt = require("bcryptjs");
const db = require("../db");

async function loginController(req, res) {
  const { name, password } = req.body;

  try {
    const results = await db.query(
      `SELECT id,
              name,
              password,
              role,
              "class",
              session,
              joining_date,
              stream,
              is_banned,
              ban_reason
       FROM students
       WHERE LOWER(TRIM(name)) = LOWER(TRIM($1))
       LIMIT 1`,
      [name]
    );

    if (results.rows.length === 0) {
      return res.json({
        success: false,
        message: "User not found",
      });
    }

    const user = results.rows[0];

    // 🚫 Account banned
    if (user.is_banned) {
      return res.json({
        success: false,
        message:
          user.ban_reason ||
          "Your Account suspended by Tuition teacher. Contact him.",
      });
    }

    // 🔐 Password check
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.json({
        success: false,
        message: "Invalid credentials",
      });
    }

    return res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        class: user.class,
        session: user.session,
        stream: user.stream,
        joining_date: user.joining_date,
      },
    });
  } catch (err) {
    console.error("Login Error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
}





// Get All Banned Students
async function getBannedStudents(req,res){

  try{

    const result = await db.query(
      `
      SELECT 
        id,
        name,
        "class",
        ban_reason,
        is_banned
      FROM students
      WHERE is_banned = TRUE
      ORDER BY id DESC
      `
    );


    res.json({
      success:true,
      students:result.rows
    });


  }catch(err){

    console.log("Get Banned Error:",err);

    res.status(500).json({
      success:false,
      message:"Server error"
    });

  }

}





// Ban Student
async function banStudent(req, res) {
  const { name, className, reason } = req.body;

  try {
    const result = await db.query(
      `
      UPDATE students
      SET
        is_banned = TRUE,
        ban_reason = $3
      WHERE
        LOWER(TRIM(name)) = LOWER(TRIM($1))
        AND LOWER(TRIM("class")) = LOWER(TRIM($2))
      RETURNING id, name, "class", is_banned, ban_reason;
      `,
      [
        name,
        className,
        reason || "Your Account suspended by Tuition teacher. Contact him.",
      ]
    );

    if (result.rows.length === 0) {
      return res.json({
        success: false,
        message: "Student not found.",
      });
    }

    return res.json({
      success: true,
      message: "Student account banned successfully.",
      student: result.rows[0],
    });
  } catch (err) {
    console.error("Ban Student Error:", err);

    return res.status(500).json({
      success: false,
      message: "Server error.",
    });
  }
}

// Unban Student
async function unbanStudent(req, res) {
  const { name, className } = req.body;

  try {
    const result = await db.query(
      `
      UPDATE students
      SET
        is_banned = FALSE,
        ban_reason = NULL
      WHERE
        LOWER(TRIM(name)) = LOWER(TRIM($1))
        AND LOWER(TRIM("class")) = LOWER(TRIM($2))
      RETURNING id, name, "class", is_banned;
      `,
      [name, className]
    );

    if (result.rows.length === 0) {
      return res.json({
        success: false,
        message: "Student not found.",
      });
    }

    return res.json({
      success: true,
      message: "Student account unbanned successfully.",
      student: result.rows[0],
    });
  } catch (err) {
    console.error("Unban Student Error:", err);

    return res.status(500).json({
      success: false,
      message: "Server error.",
    });
  }
}


//Setting lock
async function setPattern(req, res) {
  const { studentId, pattern } = req.body;

  try {
    const hash = await bcrypt.hash(pattern, 10);

    await db.query(
      `UPDATE students
       SET pattern_lock = $1,
           pattern_enabled = TRUE
       WHERE id = $2`,
      [hash, studentId]
    );

    res.json({
      success: true,
      message: "Pattern saved successfully."
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
}

async function verifyPattern(req, res) {
  const { studentId, pattern } = req.body;

  try {
    const result = await db.query(
      `SELECT pattern_lock, pattern_enabled
       FROM students
       WHERE id = $1`,
      [studentId]
    );

    if (result.rows.length === 0) {
      return res.json({
        success: false,
        message: "Student not found."
      });
    }

    const user = result.rows[0];

    if (!user.pattern_enabled) {
      return res.json({
        success: false,
        message: "Pattern not set."
      });
    }

    const isMatch = await bcrypt.compare(pattern, user.pattern_lock);

    if (!isMatch) {
      return res.json({
        success: false,
        message: "Invalid pattern."
      });
    }

    res.json({
      success: true,
      message: "Pattern verified."
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
}


//disable pattern
async function disablePattern(req, res) {
  const { studentId } = req.body;

  try {
    await db.query(
      `UPDATE students
       SET pattern_lock = NULL,
           pattern_enabled = FALSE
       WHERE id = $1`,
      [studentId]
    );

    res.json({
      success: true,
      message: "Pattern disabled."
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
}

module.exports = {
  banStudent,
  unbanStudent,
  getBannedStudents,
  loginController,
  setPattern,
  verifyPattern,
  disablePattern
};