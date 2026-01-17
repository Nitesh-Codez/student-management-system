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

/* ===== MANUAL FEE ROUTES ===== */
router.post("/", addFee);
router.get("/", getAllFees);
router.get("/student/:id", getStudentFees);
router.put("/:id", updateFee);
router.delete("/:id", deleteFee);

/* ===== PHONEPE PAYMENT ROUTES ===== */
router.post("/phonepe/pay", createPhonePePayment);
router.post("/phonepe/callback", phonePeCallback);

module.exports = router;
