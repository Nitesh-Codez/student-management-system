const db = require("../db");
const bcrypt = require("bcrypt");

// Get profile by password only
exports.getProfile = (req, res) => {
  const { password } = req.body;
  if (!password) {
    return res.status(400).json({ success: false, message: "Password is required" });
  }

  const sql = "SELECT * FROM students";
  db.query(sql, async (err, results) => {
    if (err) return res.status(500).json({ success: false, message: err.message });

    // Check password for each student
    for (let user of results) {
      const match = await bcrypt.compare(password, user.password);
      if (match) {
        return res.json({ success: true, profile: user });
      }
    }

    return res.status(404).json({ success: false, message: "Invalid password" });
  });
};

// Save or update profile by password only
exports.saveProfile = (req, res) => {
  const profile = req.body;
  const { password } = profile;

  if (!password) {
    return res.status(400).json({ success: false, message: "Password is required" });
  }

  const sql = "SELECT * FROM students";
  db.query(sql, async (err, results) => {
    if (err) return res.status(500).json({ success: false, message: err.message });

    // Try to find user by password
    let userFound = null;
    for (let user of results) {
      const match = await bcrypt.compare(password, user.password);
      if (match) {
        userFound = user;
        break;
      }
    }

    if (userFound) {
      // Update profile
      const updateSql = `
        UPDATE students SET
          name=?, class=?, role=?, mobile=?, address=?, photo=?, gender=?, category=?, dob=?,
          fatherName=?, motherName=?, brotherName=?, sisterName=?, tuition=?, updatedAt=NOW()
        WHERE id=?
      `;
      db.query(updateSql, [
        profile.name, profile.class, profile.role || "student", profile.mobile, profile.address, profile.photo,
        profile.gender, profile.category, profile.dob, profile.fatherName, profile.motherName, profile.brotherName,
        profile.sisterName, profile.tuition, userFound.id
      ], (err2) => {
        if (err2) return res.status(500).json({ success: false, message: err2.message });
        res.json({ success: true, message: "Profile updated successfully", profile });
      });
    } else {
      // Insert new user
      bcrypt.hash(password, 10, (errHash, hashedPassword) => {
        if (errHash) return res.status(500).json({ success: false, message: errHash.message });

        const insertSql = `
          INSERT INTO students
          (name,class,role,mobile,address,photo,gender,category,dob,fatherName,motherName,brotherName,sisterName,tuition,password)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        `;
        db.query(insertSql, [
          profile.name, profile.class, profile.role || "student", profile.mobile, profile.address, profile.photo,
          profile.gender, profile.category, profile.dob, profile.fatherName, profile.motherName, profile.brotherName,
          profile.sisterName, profile.tuition, hashedPassword
        ], (err3) => {
          if (err3) return res.status(500).json({ success: false, message: err3.message });
          res.json({ success: true, message: "Profile saved successfully", profile });
        });
      });
    }
  });
};
