const express = require("express");
const router = express.Router();
const multer = require("multer");

const authMiddleware = require("../middlewares/authMiddleware");
const adminMiddleware = require("../middlewares/adminMiddleware");

const {
  uploadExamDocument,
  getExamDocuments,
  deleteExamDocument,
getStudentMonthlyReport,
} = require("../controllers/academicDocumentController");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10 MB
  }
});

// ================= ADMIN UPLOAD =================

router.post(
  "/admin/upload",
  authMiddleware,
  adminMiddleware,
  upload.single("file"),
  uploadExamDocument
);


// ================= GET DOCUMENTS =================

router.get(
  "/documents",
  authMiddleware,
  getExamDocuments
);


// ================= DELETE =================

router.delete(
  "/admin/:id",
  authMiddleware,
  adminMiddleware,
  deleteExamDocument
);





router.get(
  "/student/:studentId/monthly-report",getStudentMonthlyReport
);
module.exports = router;