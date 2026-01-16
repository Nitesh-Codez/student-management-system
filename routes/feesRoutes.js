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

/* ================= CASH / MANUAL FEES ================= */

// Admin: add fee (CASH / MANUAL)
router.post("/", addFee);

// Admin: view all fees
router.get("/", getAllFees);

// Student: view own fees
router.get("/student/:id", getStudentFees);

// Admin: update fee record
router.put("/:id", updateFee);

// Admin: delete fee record
router.delete("/:id", deleteFee);

/* ================= PHONEPE PAYMENT ================= */

// Create PhonePe payment
router.post("/phonepe/pay", createPhonePePayment);

// PhonePe callback
router.post("/phonepe/callback", phonePeCallback);

module.exports = router;
