const express = require("express");

const router = express.Router();

const {
  addFee,
  getAllFees,
  getFeeById,
  updateFee,
  deleteFee,
} = require("../controllers/feesController");

//=======================================
// ADMIN SIDE 

// GET all fees
router.get("/", getAllFees);

// GET single fee
router.get("/:id", getFeeById);

// ADD fee
router.post("/", addFee);

// UPDATE fee
router.put("/:id", updateFee);

// DELETE fee
router.delete("/:id", deleteFee);

module.exports = router;