const express = require("express");
const router = express.Router();

const {
  addFee,
  getStudentFees,
  getAllFees,
  updateFee,
  deleteFee,
  createPhonePePayment,
  phonePeCallback,
  getFeeByClass
} = require("../controllers/feesController");

//Middlewares
const authMiddleware = require("../middlewares/authMiddleware");
const adminMiddleware = require("../middlewares/adminMiddleware");

// Admin Routes
router.get("/",authMiddleware,adminMiddleware, getAllFees); // Sab fees session wise dekhne ke liye

// Student Routes
router.get("/student/:id",authMiddleware, getStudentFees); // Particular student ke liye + Late Tag logic

// CRUD
router.post("/",authMiddleware,authMiddleware, addFee);
router.put("/:id",authMiddleware,authMiddleware, updateFee);
router.delete("/:id",authMiddleware,authMiddleware, deleteFee);

/* ===== PHONEPE PAYMENT ROUTES ===== */
router.post("/phonepe/pay",authMiddleware, createPhonePePayment);
router.post("/phonepe/callback",authMiddleware, phonePeCallback);
router.get("/get-fee/:className",authMiddleware, getFeeByClass);

module.exports = router;
