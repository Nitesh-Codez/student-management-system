import express from "express";
import {
  createQuiz,
  getQuizByClass,
  getSingleQuiz,
  submitQuiz
} from "../controllers/quizController.js";

const router = express.Router();

router.post("/create", createQuiz);
router.get("/class/:class_name", getQuizByClass);
router.get("/:id", getSingleQuiz);
router.post("/submit", submitQuiz);

export default router;