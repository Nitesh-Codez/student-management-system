const db = require("../db");
const { createClient } = require("@supabase/supabase-js");
const bcrypt = require("bcryptjs");

// ================= SUPABASE =================
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const TEACHER_BUCKET = "teachers";

// =================================================
// ================= ADD TEACHER ====================
// =================================================
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
      password
    } = req.body;

    let profile_photo = null;

    // ========= PHOTO UPLOAD =========
    if (req.file) {
      const fileName = `${Date.now()}-${req.file.originalname}`;
      const path = `profiles/${fileName}`;

      const { error } = await supabase.storage
        .from(TEACHER_BUCKET)
        .upload(path, req.file.buffer, {
          contentType: req.file.mimetype
        });

      if (error) throw error;

      const { data } = supabase.storage
        .from(TEACHER_BUCKET)
        .getPublicUrl(path);

      profile_photo = data.publicUrl;
    }

    // ========= PASSWORD HASH =========
    const hashedPassword = await bcrypt.hash(password || "123456", 10);

    // ========= DB INSERT =========
    const sql = `
      INSERT INTO teachers
      (teacher_code,name,gender,dob,phone,email,address,qualification,experience_years,salary,joining_date,profile_photo,password)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
    `;

    await db.query(sql, [
      teacher_code,
      name,
      gender,
      dob || null,
      phone,
      email,
      address,
      qualification,
      experience_years || 0,
      salary || 0,
      joining_date || null,
      profile_photo,
      hashedPassword
    ]);

    res.json({ success:true, message:"Teacher added successfully ✅" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success:false, message: err.message });
  }
};

// =================================================
// ================= GET TEACHERS ===================
// =================================================
exports.getTeachers = async (req,res)=>{
  try{
    const result = await db.query(`SELECT *, password FROM teachers ORDER BY id DESC`);
    res.json(result.rows);
  }catch(err){
    console.error(err);
    res.status(500).json({success:false});
  }
};

// =================================================
// ================= UPDATE TEACHER =================
// =================================================
exports.updateTeacher = async (req,res)=>{
  try{
    const { id } = req.params;
    const {
      name,
      phone,
      email,
      qualification,
      experience_years,
      salary,
      status,
      password
    } = req.body;

    let profile_photo = null;

    // ===== photo replace =====
    if(req.file){
      const fileName = `${Date.now()}-${req.file.originalname}`;
      const path = `profiles/${fileName}`;

      const { error } = await supabase.storage
        .from(TEACHER_BUCKET)
        .upload(path, req.file.buffer,{
          contentType:req.file.mimetype
        });

      if(error) throw error;

      const { data } = supabase.storage
        .from(TEACHER_BUCKET)
        .getPublicUrl(path);

      profile_photo = data.publicUrl;
    }

    // ===== hash password if provided =====
    let hashedPassword = undefined;
    if(password){
      hashedPassword = await bcrypt.hash(password,10);
    }

    const sql = `
      UPDATE teachers SET
        name = COALESCE($1,name),
        phone = COALESCE($2,phone),
        email = COALESCE($3,email),
        qualification = COALESCE($4,qualification),
        experience_years = COALESCE($5,experience_years),
        salary = COALESCE($6,salary),
        status = COALESCE($7,status),
        profile_photo = COALESCE($8,profile_photo)
        ${hashedPassword ? ", password=$9" : ""}
      WHERE id=$${hashedPassword ? 10 : 9}
    `;

    const values = [name, phone, email, qualification, experience_years, salary, status, profile_photo];
    if(hashedPassword) values.push(hashedPassword);
    values.push(id);

    const result = await db.query(sql, values);

    if(!result.rowCount)
      return res.json({success:false,message:"Not found"});

    res.json({success:true,message:"Teacher updated ✅"});

  }catch(err){
    console.error(err);
    res.status(500).json({success:false});
  }
};

// =================================================
// ================= DELETE TEACHER =================
// =================================================
exports.deleteTeacher = async (req,res)=>{
  try{
    const { id } = req.params;

    await db.query(`DELETE FROM teachers WHERE id=$1`,[id]);

    res.json({success:true,message:"Teacher deleted ✅"});

  }catch(err){
    console.error(err);
    res.status(500).json({success:false});
  }
};
