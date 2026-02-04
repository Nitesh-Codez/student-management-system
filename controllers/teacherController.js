const db = require("../db");

// ================= ADD TEACHER =================
exports.addTeacher = async (req, res) => {
  try {
    const {
      teacher_code,
      name,
      gender,
      dob,
      phone,
      email,
      address,
      qualification,
      experience_years,
      salary,
      joining_date,
      status
    } = req.body;

    const sql = `
      INSERT INTO teachers
      (teacher_code,name,gender,dob,phone,email,address,qualification,experience_years,salary,joining_date,status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
    `;

    await db.query(sql, [
      teacher_code,
      name,
      gender,
      dob,
      phone,
      email,
      address,
      qualification,
      experience_years,
      salary,
      joining_date,
      status
    ]);

    res.json({ success: true, message: "Teacher added successfully" });

  } catch (err) {
    console.log(err);
    res.status(500).json({ success:false, message:"Insert failed" });
  }
};


// ================= GET ALL TEACHERS =================
exports.getTeachers = async (req, res) => {
  try {
    const result = await db.query(`SELECT * FROM teachers ORDER BY id DESC`);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ success:false });
  }
};


// ================= UPDATE TEACHER =================
exports.updateTeacher = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      name,
      phone,
      email,
      qualification,
      experience_years,
      salary,
      status
    } = req.body;

    const sql = `
      UPDATE teachers SET
      name = COALESCE($1,name),
      phone = COALESCE($2,phone),
      email = COALESCE($3,email),
      qualification = COALESCE($4,qualification),
      experience_years = COALESCE($5,experience_years),
      salary = COALESCE($6,salary),
      status = COALESCE($7,status)
      WHERE id = $8
    `;

    const result = await db.query(sql, [
      name,
      phone,
      email,
      qualification,
      experience_years,
      salary,
      status,
      id
    ]);

    if (!result.rowCount)
      return res.json({ success:false, message:"Not found" });

    res.json({ success:true, message:"Teacher updated" });

  } catch (err) {
    res.status(500).json({ success:false });
  }
};


// ================= DELETE TEACHER =================
exports.deleteTeacher = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(`DELETE FROM teachers WHERE id=$1`,[id]);

    if (!result.rowCount)
      return res.json({ success:false, message:"Not found" });

    res.json({ success:true, message:"Teacher deleted" });

  } catch (err) {
    res.status(500).json({ success:false });
  }
};
