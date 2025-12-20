const express = require("express");
const multer = require("multer");
const {
  uploadStudyMaterial,
  getMaterialByClass,
  deleteMaterial,
} = require("../controllers/studyMaterialController");

const router = express.Router();
const upload = multer({ dest: "temp/" });

router.post("/upload", upload.single("file"), uploadStudyMaterial);
router.get("/:className", getMaterialByClass);
router.delete("/:id", deleteMaterial);

module.exports = router;
