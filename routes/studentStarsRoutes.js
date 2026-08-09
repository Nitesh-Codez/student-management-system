const express = require("express");
const router = express.Router();

const starController = require("../controllers/studentStarsController");

//Middlewares
const authMiddleware = require("../middlewares/authMiddleware");
const adminMiddleware = require("../middlewares/adminMiddleware");

// Class wise students
router.get("/students", starController.getStudentsByClass);

// Save stars
router.post("/save", starController.saveStudentStars);

// Leaderboard
router.get("/leaderboard", starController.getLeaderboard);

//get students side  star on their dashboard 
router.get("/my-tree", starController.getMyTree);

// Student Rank
router.get("/my-rank", starController.getMyRank);

module.exports = router;