import express from "express";
import {
  uploadMaterial,
  getSubjectsByClass,
  getMaterialByClassAndSubject,
  deleteMaterial
} from "../controllers/studyMaterialController.js";

const router = express.Router();

/* ADMIN */
router.post("/admin/upload", uploadMaterial);
router.delete("/admin/:id", deleteMaterial);

/* STUDENT */
router.get("/subjects/:class", getSubjectsByClass);
router.get("/:class/:subject", getMaterialByClassAndSubject);

export default router;
