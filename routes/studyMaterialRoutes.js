const express = require("express");
const multer = require("multer");
const {
  uploadStudyMaterial,
  getMaterialByClass,
  downloadMaterial,
  deleteMaterial,
  viewMaterial, // 🔥 new controller
} = require("../controllers/studyMaterialController");

const router = express.Router();

// ================= MULTER =================
const upload = multer({ dest: "temp/" }); // Temporary local upload

// ================= ROUTES =================
router.post("/upload", upload.single("file"), uploadStudyMaterial);
router.get("/download/:id", downloadMaterial);
router.get("/view/:id", viewMaterial); // 🔥 NEW route for View in browser
router.get("/:className", getMaterialByClass);
router.delete("/:id", deleteMaterial);

// ================= TEST ROUTE =================
router.get("/test-files/:className", async (req, res) => {
  res.send("Now files are on Cloudinary, local folder not needed.");
});

module.exports = router;
