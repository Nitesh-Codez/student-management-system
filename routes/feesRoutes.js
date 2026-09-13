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
router.get("/all-fee", getAllFees);

// GET single fee
router.get("/:id", getFeeById);

// ADD fee
router.post("/add", addFee);

// UPDATE fee
router.put("update/:id", updateFee);

// DELETE fee
router.delete("delete/:id", deleteFee);

module.exports = router;