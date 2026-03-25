const bcrypt = require("bcryptjs");
const db = require("../db");
const multer = require("multer");
const { createClient } = require("@supabase/supabase-js");

// --------------------- Supabase Setup ---------------------
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// --------------------- Multer Setup ---------------------
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter(req, file, cb) {
    if (!file.mimetype.startsWith("image/")) {
      cb(new Error("Only image files allowed"));
    } else {
      cb(null, true);
    }
  }
});

// --------------------- CRUD STUDENT ---------------------

// Get all students
exports.getStudents = async (req, res) => {
  try {
    const results = await db.query(
      "SELECT id, name, \"class\", mobile, address, profile_photo FROM students WHERE role='student'"
    );
    res.json({ success: true, students: results.rows });
  } catch (err) {
    console.log("DB ERROR:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// Add student
exports.addStudent = async (req, res) => {
  const { name, class: studentClass, password, mobile = null, address = null } = req.body;

  if (!name || !studentClass || !password) {
    return res.json({ success: false, message: "Name, class and password are required" });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await db.query(
      "INSERT INTO students (name, \"class\", password, mobile,joining_date, address, role) VALUES ($1,$2,$3,$4,$5,'student') RETURNING id",
      [name, studentClass, hashedPassword, mobile, address]
    );

    res.json({
      success: true,
      message: "Student added successfully",
      id: result.rows[0].id
    });

  } catch (err) {
    console.log("DB ERROR:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// Delete student
exports.deleteStudent = async (req, res) => {
  const { id } = req.params;

  try {
    await db.query("DELETE FROM students WHERE id = $1", [id]);
    res.json({ success: true, message: "Student deleted successfully" });

  } catch (err) {
    console.log("DB ERROR:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// --------------------- PROFILE PHOTO ---------------------

exports.uploadProfilePhoto = async (req, res) => {
  try {
    const { id } = req.params;

    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    const student = await db.query("SELECT * FROM students WHERE id=$1", [id]);

    if (student.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Student not found" });
    }

    const fileName = `student-${id}-${Date.now()}.jpg`;

    // Upload to Supabase bucket
    const { error } = await supabase.storage
      .from(process.env.SUPABASE_STUDENT_BUCKET)
      .upload(fileName, req.file.buffer, {
        contentType: req.file.mimetype
      });

    if (error) {
      console.log(error);
      return res.status(500).json({ success: false, message: "Upload failed" });
    }

    // Get public URL
    const { data } = supabase.storage
      .from(process.env.SUPABASE_STUDENT_BUCKET)
      .getPublicUrl(fileName);

    const photoUrl = data.publicUrl;

    // Save URL in database
    await db.query(
      "UPDATE students SET profile_photo=$1 WHERE id=$2",
      [photoUrl, id]
    );

    res.json({
      success: true,
      message: "Profile photo uploaded successfully",
      profile_photo: photoUrl
    });

  } catch (error) {
    console.log("Upload Error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Get profile photo
exports.getProfilePhoto = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      "SELECT id,name,profile_photo FROM students WHERE id=$1",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Student not found" });
    }

    res.json({ success: true, user: result.rows[0] });

  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const getStudentClassHistory = async (req,res)=>{
 try{

  const studentId = req.query.id;

  const result = await db.query(
   "SELECT class,year FROM student_class_history WHERE student_id=$1 ORDER BY year",
   [studentId]
  );

  res.json({
   success:true,
   history:result.rows
  });

 }catch(err){
  res.status(500).json({success:false,message:"Server error"});
 }
};

exports.getStudentClassHistory = getStudentClassHistory;

// Export multer
exports.uploadMiddleware = upload;