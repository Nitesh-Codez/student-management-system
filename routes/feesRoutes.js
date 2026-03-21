const express = require("express");
const router = express.Router();

const {
  addFee,
  getStudentFees,
  getAllFees,
  updateFee,
  deleteFee,
  createPhonePePayment,
  phonePeCallback
} = require("../controllers/feesController");

// Admin Routes
router.get("/", getAllFees); // Sab fees session wise dekhne ke liye

// Student Routes
router.get("/student/:id", getStudentFees); // Particular student ke liye + Late Tag logic

// CRUD
router.post("/", addFee);
router.put("/:id", updateFee);
router.delete("/:id", deleteFee);

/* ===== PHONEPE PAYMENT ROUTES ===== */
router.post("/phonepe/pay", createPhonePePayment);
router.post("/phonepe/callback", phonePeCallback);

module.exports = router;
