import express from "express";
import multer from "multer";
import {
  uploadMaterial,
  getAllMaterials,
  getSubjectsByClass,
  getMaterialByClassAndSubject,
  deleteMaterial
} from "../controllers/studyMaterialController.js";

const router = express.Router();

/* =========================
   MULTER CONFIGURATION
========================= */
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, Date.now() + "_" + file.originalname)
});

const upload = multer({ storage });

/* =========================
   ADMIN ROUTES
========================= */
router.post("/admin/upload", upload.single("file"), uploadMaterial);
router.delete("/admin/:id", deleteMaterial);
router.get("/admin/all", getAllMaterials); // GET all materials

/* =========================
   STUDENT ROUTES
========================= */
router.get("/subjects/:class", getSubjectsByClass);
router.get("/:class/:subject", getMaterialByClassAndSubject);

export default router;
