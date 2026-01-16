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

/* ===== MANUAL FEES ===== */
router.post("/", addFee);
router.get("/", getAllFees);
router.get("/student/:id", getStudentFees);
router.put("/:id", updateFee);
router.delete("/:id", deleteFee);

/* ===== PHONEPE ===== */
router.post("/phonepe/pay", createPhonePePayment);
router.post("/phonepe/callback", phonePeCallback);

module.exports = router;
