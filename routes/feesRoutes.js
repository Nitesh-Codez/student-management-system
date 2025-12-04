const express = require("express");
const router = express.Router();
const { addFee, getStudentFees, getAllFees, updateFee, deleteFee } = require("../controllers/feesController");

// Admin: add fee
router.post("/", addFee);

// Admin: view all fees
router.get("/", getAllFees);

// Student: view own fees
router.get("/:id", getStudentFees);

// Admin: update fee record
router.put("/:id", updateFee);

// Admin: delete fee record
router.delete("/:id", deleteFee);

module.exports = router;