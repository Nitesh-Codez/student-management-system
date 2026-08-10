const express = require("express");
const router = express.Router();

const starController = require("../controllers/studentStarsController");

//Middlewares
const authMiddleware = require("../middlewares/authMiddleware");
const adminMiddleware = require("../middlewares/adminMiddleware");

// Class wise students
router.get("/students",authMiddleware, starController.getStudentsByClass);

// Save stars
router.post("/save",authMiddleware,adminMiddleware, starController.saveStudentStars);

// Leaderboard
router.get("/leaderboard",authMiddleware, starController.getLeaderboard);

//get students side  star on their dashboard 
router.get("/my-tree",authMiddleware, starController.getMyTree);

// Student Rank
router.get("/my-rank",authMiddleware,  starController.getMyRank);

module.exports = router;