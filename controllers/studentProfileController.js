const db = require("../db"); // MySQL connection

// Get student profile by studentCode
exports.getProfile = (req, res) => {
  const { studentCode } = req.params;
  const sql = "SELECT * FROM student_profile WHERE studentCode = ?";
  db.query(sql, [studentCode], (err, results) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    if (results.length === 0) return res.status(404).json({ success: false, message: "Profile not found" });
    res.json({ success: true, profile: results[0] });
  });
};

// Create or update student profile
exports.saveProfile = (req, res) => {
  const profile = req.body;

  const checkSql = "SELECT * FROM student_profile WHERE studentCode = ?";
  db.query(checkSql, [profile.studentCode], (err, results) => {
    if (err) return res.status(500).json({ success: false, message: err.message });

    if (results.length > 0) {
      // Update existing profile
      const updateSql = `
        UPDATE student_profile SET 
          name=?, class=?, email=?, photo=?, gender=?, category=?, dob=?,
          fatherName=?, motherName=?, brotherName=?, sisterName=?, tuition=?,
          mobile=?, address=?, city=?, state=?, pincode=?, aatu=?, extraNotes=?, updatedAt=NOW()
        WHERE studentCode=?
      `;
      db.query(updateSql, [
        profile.name, profile.class, profile.email, profile.photo, profile.gender, profile.category, profile.dob,
        profile.fatherName, profile.motherName, profile.brotherName, profile.sisterName, profile.tuition,
        profile.mobile, profile.address, profile.city, profile.state, profile.pincode, profile.aatu, profile.extraNotes,
        profile.studentCode
      ], (err2) => {
        if (err2) return res.status(500).json({ success: false, message: err2.message });
        res.json({ success: true, message: "Profile updated successfully" });
      });
    } else {
      // Insert new profile
      const insertSql = `
        INSERT INTO student_profile 
        (name,class,email,photo,gender,category,dob,fatherName,motherName,brotherName,sisterName,tuition,
        mobile,address,city,state,pincode,studentCode,aatu,extraNotes) 
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `;
      db.query(insertSql, [
        profile.name, profile.class, profile.email, profile.photo, profile.gender, profile.category, profile.dob,
        profile.fatherName, profile.motherName, profile.brotherName, profile.sisterName, profile.tuition,
        profile.mobile, profile.address, profile.city, profile.state, profile.pincode, profile.studentCode, profile.aatu, profile.extraNotes
      ], (err3) => {
        if (err3) return res.status(500).json({ success: false, message: err3.message });
        res.json({ success: true, message: "Profile saved successfully" });
      });
    }
  });
};
