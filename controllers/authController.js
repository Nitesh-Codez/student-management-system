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

module.exports = { loginController };




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

module.exports = {
  banStudent,
  unbanStudent,
};