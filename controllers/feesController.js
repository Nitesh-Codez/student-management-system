const db = require("../db");
const crypto = require("crypto");
const axios = require("axios");

/* ================= CONFIG ================= */
const MERCHANT_ID = process.env.PHONEPE_MID;
const SALT_KEY = process.env.PHONEPE_SALT;
const SALT_INDEX = "1";

const PHONEPE_BASE_URL = "https://api-preprod.phonepe.com/apis/pg-sandbox";

/* ================= ADD FEE (CASH) ================= */
async function addFee(req, res) {
  try {
    const {
      student_id,
      student_name,
      class_name,
      amount,
      payment_date,
      payment_time,
      status,
      session, // Frontend se session aayega
      stream,  // Frontend se stream aayega (if any)
      payment_mode = "CASH"
    } = req.body;

    await db.query(
      `INSERT INTO fees 
      (student_id, student_name, class_name, amount, payment_date, payment_time, status, payment_mode, payment_status, session, stream) 
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'SUCCESS',$9,$10)`,
      [
        student_id,
        student_name,
        class_name,
        amount,
        payment_date,
        payment_time,
        status || "On Time",
        payment_mode,
        session, // Save Session
        stream   // Save Stream
      ]
    );

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
}

/* ================= CREATE PHONEPE PAYMENT ================= */
async function createPhonePePayment(req, res) {
  try {
    const { student_id, student_name, class_name, amount, session, stream } = req.body;

    const merchantTransactionId = "TXN_" + Date.now();

    const payload = {
      merchantId: MERCHANT_ID,
      merchantTransactionId,
      amount: amount * 100,
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

    const response = await axios.post(
      `${PHONEPE_BASE_URL}/pg/v1/pay`,
      { request: payloadBase64 },
      { headers: { "X-VERIFY": checksum } }
    );

    // Save with Session & Stream in Pending state
    await db.query(
      `INSERT INTO fees 
      (student_id, student_name, class_name, amount, payment_mode, merchant_txn_id, payment_status, session, stream) 
      VALUES ($1,$2,$3,$4,'PHONEPE',$5,'PENDING',$6,$7)`,
      [student_id, student_name, class_name, amount, merchantTransactionId, session, stream]
    );

    res.json({
      success: true,
      redirectUrl: response.data.data.instrumentResponse.redirectInfo.url
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
}

/* ================= PHONEPE CALLBACK ================= */
async function phonePeCallback(req, res) {
  try {
    const merchantTransactionId = req.body?.data?.merchantTransactionId;

    if (!merchantTransactionId)
      return res.redirect(`${process.env.FRONTEND_URL}/payment-failed`);

    const statusPath = `/pg/v1/status/${MERCHANT_ID}/${merchantTransactionId}`;

    const checksum =
      crypto
        .createHash("sha256")
        .update(statusPath + SALT_KEY)
        .digest("hex") +
      "###" +
      SALT_INDEX;

    const statusRes = await axios.get(`${PHONEPE_BASE_URL}${statusPath}`, {
      headers: {
        "X-VERIFY": checksum,
        "X-MERCHANT-ID": MERCHANT_ID
      }
    });

    const paymentState = statusRes.data.data.state;

    if (paymentState === "COMPLETED") {
      await db.query(
        `UPDATE fees SET payment_status='SUCCESS', payment_date=CURRENT_DATE, payment_time=CURRENT_TIME, status='On Time' WHERE merchant_txn_id=$1`,
        [merchantTransactionId]
      );
      return res.redirect(`${process.env.FRONTEND_URL}/payment-success`);
    } else {
      await db.query(
        `UPDATE fees SET payment_status='FAILED' WHERE merchant_txn_id=$1`,
        [merchantTransactionId]
      );
      return res.redirect(`${process.env.FRONTEND_URL}/payment-failed`);
    }
  } catch (err) {
    console.error("Callback error:", err);
    res.redirect(`${process.env.FRONTEND_URL}/payment-failed`);
  }
}

/* ================= CRUD & FILTERS ================= */

// UPDATE & DELETE (Same as before)
async function updateFee(req, res) {
  try {
    await db.query(`UPDATE fees SET amount=$1 WHERE id=$2`, [req.body.amount, req.params.id]);
    res.json({ success: true });
  } catch {
    res.status(500).json({ success: false });
  }
}

async function deleteFee(req, res) {
  await db.query("DELETE FROM fees WHERE id=$1", [req.params.id]);
  res.json({ success: true });
}

// Get Fees for a specific Student with Session Filter
async function getStudentFees(req, res) {
  const { id } = req.params;
  const { session } = req.query; // Query parameter se session uthayenge

  let query = "SELECT * FROM fees WHERE student_id=$1";
  let params = [id];

  if (session) {
    query += " AND session=$2";
    params.push(session);
  }

  query += " ORDER BY payment_date DESC";

  try {
    const { rows } = await db.query(query, params);
    res.json({ success: true, fees: rows });
  } catch (err) {
    res.status(500).json({ success: false });
  }
}

// Get All Fees with Session Filter (For Admin History)
async function getAllFees(req, res) {
  const { session } = req.query; // Admin dashboard se session select karein

  let query = "SELECT * FROM fees";
  let params = [];

  if (session) {
    query += " WHERE session=$1";
    params.push(session);
  }

  query += " ORDER BY payment_date DESC";

  try {
    const { rows } = await db.query(query, params);
    res.json({ success: true, fees: rows });
  } catch (err) {
    res.status(500).json({ success: false });
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