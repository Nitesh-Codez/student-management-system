const db = require("../db");
const crypto = require("crypto");
const axios = require("axios");


//=====================================================
// ADMIN SIDE 
//=====================================================


// =========================
// ADD FEE
// =========================
const addFee = async (req, res) => {
  try {
    const {
      student_id,
      student_name,
      class_name,
      amount,
      payment_date,
      payment_time,
      status,
      payment_mode,
      merchant_txn_id,
      payment_status,
      stream,
      session,
      fee_month,
    } = req.body;

    if (
      !student_id ||
      !student_name ||
      !class_name ||
      !amount ||
      !payment_date ||
      !payment_time ||
      !fee_month
    ) {
      return res.status(400).json({
        success: false,
        message: "Required fee details are missing",
      });
    }

    const query = `
      INSERT INTO fees (
        student_id,
        student_name,
        class_name,
        amount,
        payment_date,
        payment_time,
        status,
        payment_mode,
        merchant_txn_id,
        payment_status,
        stream,
        session,
        fee_month
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      RETURNING *
    `;

    const values = [
      student_id,
      student_name,
      class_name,
      amount,
      payment_date,
      payment_time,
      status || "On Time",
      payment_mode || "CASH",
      merchant_txn_id || null,
      payment_status || "SUCCESS",
      stream || null,
      session || null,
      fee_month,
    ];

    const result = await pool.query(query, values);

    res.status(201).json({
      success: true,
      message: "Fee added successfully",
      fee: result.rows[0],
    });
  } catch (error) {
    console.error("Add Fee Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to add fee",
      error: error.message,
    });
  }
};


// =========================
// GET ALL FEES
// =========================
const getAllFees = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT *
      FROM fees
      ORDER BY payment_date DESC, payment_time DESC
    `);

    res.status(200).json({
      success: true,
      fees: result.rows,
    });
  } catch (error) {
    console.error("Get Fees Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch fees",
      error: error.message,
    });
  }
};


// =========================
// GET FEE BY ID
// =========================
const getFeeById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT * FROM fees WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Fee record not found",
      });
    }

    res.status(200).json({
      success: true,
      fee: result.rows[0],
    });
  } catch (error) {
    console.error("Get Fee Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch fee",
      error: error.message,
    });
  }
};


// =========================
// UPDATE FEE
// =========================
const updateFee = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      student_id,
      student_name,
      class_name,
      amount,
      payment_date,
      payment_time,
      status,
      payment_mode,
      merchant_txn_id,
      payment_status,
      stream,
      session,
      fee_month,
    } = req.body;

    const query = `
      UPDATE fees
      SET
        student_id = $1,
        student_name = $2,
        class_name = $3,
        amount = $4,
        payment_date = $5,
        payment_time = $6,
        status = $7,
        payment_mode = $8,
        merchant_txn_id = $9,
        payment_status = $10,
        stream = $11,
        session = $12,
        fee_month = $13
      WHERE id = $14
      RETURNING *
    `;

    const values = [
      student_id,
      student_name,
      class_name,
      amount,
      payment_date,
      payment_time,
      status || "On Time",
      payment_mode || "CASH",
      merchant_txn_id || null,
      payment_status || "SUCCESS",
      stream || null,
      session || null,
      fee_month,
      id,
    ];

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Fee record not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Fee updated successfully",
      fee: result.rows[0],
    });
  } catch (error) {
    console.error("Update Fee Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update fee",
      error: error.message,
    });
  }
};


// =========================
// DELETE FEE
// =========================
const deleteFee = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `DELETE FROM fees WHERE id = $1 RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Fee record not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Fee deleted successfully",
      fee: result.rows[0],
    });
  } catch (error) {
    console.error("Delete Fee Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to delete fee",
      error: error.message,
    });
  }
};


module.exports = {
  addFee,
  getAllFees,
  getFeeById,
  updateFee,
  deleteFee,
};

