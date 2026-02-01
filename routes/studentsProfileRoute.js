const express = require("express");
const router = express.Router();

const {
  getStudentProfile,
  insertStudent,
updateStudentProfile,
  requestProfileEdit,
  handleEditRequest,
} = require("../controllers/studentsProfileController");

// GET profile
// /api/students/profile?id=27
router.get("/profile", getStudentProfile);

// INSERT student
// /api/students/add
router.post("/add", insertStudent);
// UPDATE profile
// /api/students/update/27
router.put("/update/:id", updateStudentProfile);

// student → request edit
router.post("/request-edit", requestProfileEdit);

// admin → approve / reject
router.post("/handle-edit", handleEditRequest);



module.exports = router;
