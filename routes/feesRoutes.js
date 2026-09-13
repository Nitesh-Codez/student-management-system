const express = require("express");

const router = express.Router();

const {
  addFee,
  getAllFees,
  getFeeById,
  updateFee,
  deleteFee,
} = require("../controllers/feesController");
const authMiddleware = require("../middlewares/authMiddleware");
const adminMiddleware = require("../middlewares/adminMiddleware");

//=======================================
// ADMIN SIDE 

// GET all fees
router.get("/all-fee",authMiddleware,adminMiddleware, getAllFees);

// GET single fee
router.get("/:id",authMiddleware,getFeeById);

// ADD fee
router.post("/add",authMiddleware,adminMiddleware, addFee);

// UPDATE fee
router.put("/update/:id",authMiddleware,adminMiddleware, updateFee);

// DELETE fee
router.delete("/delete/:id",authMiddleware,adminMiddleware, deleteFee);

module.exports = router;