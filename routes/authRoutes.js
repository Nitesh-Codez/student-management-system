const express = require("express");
const router = express.Router();

const {
 loginController,
 banStudent,
 unbanStudent,
 getBannedStudents,
 setPattern,
 verifyPattern,
 disablePattern
} = require("../controllers/authController");

// Login
router.post("/login", loginController);

// Ban Student
router.post("/ban", banStudent);

// Unban Student
router.post("/unban", unbanStudent);

//get all the banned students

router.get("/banned-students", getBannedStudents);


//Security pins

router.post("/set-pattern", setPattern);
router.post("/verify-pattern", verifyPattern);
router.post("/disable-pattern", disablePattern);
module.exports = router;