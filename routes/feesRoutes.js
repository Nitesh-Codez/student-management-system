const express = require("express");
const router = express.Router();
const { addFee, getStudentFees, getAllFees } = require("../controllers/feesController");

// Admin: add fee
router.post("/", addFee);

// Admin: view all fees
router.get("/", getAllFees);

// Student: view own fees
router.get("/:id", getStudentFees);

module.exports = router;
