const db = require("../db");
const crypto = require("crypto");
const axios = require("axios");

/* ================= PHONEPE CONFIG ================= */
const MERCHANT_ID = process.env.PHONEPE_MID;
const SALT_KEY = process.env.PHONEPE_SALT;
const SALT_INDEX = "1";
const PHONEPE_URL = "https://api-preprod.phonepe.com/apis/pg-sandbox";
/* ================================================= */

/* ================= ADD FEE (CASH / MANUAL) ================= */
async function addFee(req, res) {
  const {
    student_id,
    student_name,
    class_name,
    amount,
    payment_date,
    payment_time,
    status,
    payment_mode = "CASH"
  } = req.body;

  if (!student_id || !student_name || !class_name || !amount || !payment_date || !payment_time) {
    return res.status(400).json({ success: false, message: "All fields are required" });
  }

  try {
    await db.query(
      `INSERT INTO fees
       (student_id, student_name, class_name, amount, payment_date, payment_time, status, payment_mode, payment_status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'SUCCESS')`,
      [
        student_id,
        student_name,
        class_name,
        amount,
        payment_date,
        payment_time,
        status || "On Time",
        payment_mode
      ]
    );

    res.json({ success: true, message: "Fee record added successfully!" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

/* ================= PHONEPE PAYMENT CREATE ================= */
async function createPhonePePayment(req, res) {
  try {
    const { student_id, student_name, class_name, amount } = req.body;

    if (!student_id || !student_name || !class_name || !amount) {
      return res.status(400).json({ success: false, message: "Missing fields" });
    }

    const merchantTransactionId = "TXN_" + Date.now();

    const payload = {
      merchantId: MERCHANT_ID,
      merchantTransactionId,
      amount: amount * 100, // in paise
      redirectUrl: `${process.env.BACKEND_URL}/api/fees/phonepe/callback`,
      redirectMode: "POST",
      paymentInstrument: { type: "PAY_PAGE" }
    };

    const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString("base64");

    const checksum =
      crypto
        .createHash("sha256")
        .update(payloadBase64 + "/pg/v1/pay" + SALT_KEY)
        .digest("hex") +
      "###" +
      SALT_INDEX;

    const phonepeRes = await axios.post(
      `${PHONEPE_URL}/pg/v1/pay`,
      { request: payloadBase64 },
      { headers: { "X-VERIFY": checksum } }
    );

    // Store pending transaction
    await db.query(
      `INSERT INTO fees
       (student_id, student_name, class_name, amount, payment_mode, merchant_txn_id, payment_status)
       VALUES ($1,$2,$3,$4,'PHONEPE',$5,'PENDING')`,
      [student_id, student_name, class_name, amount, merchantTransactionId]
    );

    res.json({
      success: true,
      redirectUrl: phonepeRes.data.data.instrumentResponse.redirectInfo.url
    });
  } catch (err) {
    console.error("PhonePe create error:", err);
    res.status(500).json({ success: false, message: "Payment init failed" });
  }
}

/* ================= PHONEPE CALLBACK ================= */
async function phonePeCallback(req, res) {
  try {
    const merchantTransactionId =
      req.body?.merchantTransactionId ||
      req.body?.data?.merchantTransactionId;

    const state =
      req.body?.code ||
      req.body?.data?.state;

    if (!merchantTransactionId) {
      return res.status(400).send("Invalid callback");
    }

    if (state === "PAYMENT_SUCCESS" || state === "COMPLETED") {
      await db.query(
        `UPDATE fees
         SET payment_status='SUCCESS',
             payment_date=CURRENT_DATE,
             payment_time=CURRENT_TIME,
             status='On Time'
         WHERE merchant_txn_id=$1`,
        [merchantTransactionId]
      );
    } else {
      await db.query(
        `UPDATE fees
         SET payment_status='FAILED'
         WHERE merchant_txn_id=$1`,
        [merchantTransactionId]
      );
    }

    res.redirect(`${process.env.FRONTEND_URL}/payment-success`);
  } catch (err) {
    console.error("Callback error:", err);
    res.status(500).send("Callback error");
  }
}

/* ================= UPDATE FEE ================= */
async function updateFee(req, res) {
  try {
    const feeId = req.params.id;
    const { student_id, student_name, class_name, amount, payment_date, payment_time, status } = req.body;

    await db.query(
      `UPDATE fees
       SET student_id=$1, student_name=$2, class_name=$3,
           amount=$4, payment_date=$5, payment_time=$6, status=$7
       WHERE id=$8`,
      [
        student_id,
        student_name,
        class_name,
        amount,
        payment_date,
        payment_time,
        status,
        feeId
      ]
    );

    res.json({ success: true, message: "Fee updated successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

/* ================= DELETE FEE ================= */
async function deleteFee(req, res) {
  try {
    await db.query("DELETE FROM fees WHERE id=$1", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

/* ================= GET STUDENT FEES ================= */
async function getStudentFees(req, res) {
  try {
    const { rows } = await db.query(
      "SELECT * FROM fees WHERE student_id=$1 ORDER BY payment_date DESC",
      [req.params.id]
    );
    res.json({ success: true, fees: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

/* ================= GET ALL FEES ================= */
async function getAllFees(req, res) {
  try {
    const { rows } = await db.query(
      "SELECT * FROM fees ORDER BY payment_date DESC"
    );
    res.json({ success: true, fees: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  addFee,
  createPhonePePayment,
  phonePeCallback,
  updateFee,
  deleteFee,
  getStudentFees,
  getAllFees
};
