
const express = require("express");
const router = express.Router();

const {
  addFee,
  getAllFees,
  getFeeById,
  updateFee,
  deleteFee,
  getMonthlyFeeByClass,
  getFeesBySession,
} = require("../controllers/feesController");

const authMiddleware = require("../middlewares/authMiddleware");
const adminMiddleware = require("../middlewares/adminMiddleware");

// GET all fees (session/month filters supported)
router.get("/all-fee", authMiddleware, adminMiddleware, getAllFees);

// GET fees by session
router.get("/session", getFeesBySession);

// GET monthly fee by class
router.get("/monthly-fee/:class_name", getMonthlyFeeByClass);

// ADD fee
router.post("/add", authMiddleware, adminMiddleware, addFee);

// UPDATE fee
router.put("/update/:id", authMiddleware, adminMiddleware, updateFee);

// DELETE fee
router.delete("/delete/:id", authMiddleware, adminMiddleware, deleteFee);

// GET single student's fees — keep after specific routes
router.get("/:id", authMiddleware, getFeeById);

module.exports = router;
