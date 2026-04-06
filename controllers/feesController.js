const db = require("../db");
const crypto = require("crypto");
const axios = require("axios");

/* ================= CONFIG ================= */
const MERCHANT_ID = process.env.PHONEPE_MID;
const SALT_KEY = process.env.PHONEPE_SALT;
const SALT_INDEX = "1";
const PHONEPE_BASE_URL = "https://api-preprod.phonepe.com/apis/pg-sandbox";

/* ================= UTILITY: GET CURRENT SESSION START DATE ================= */


/* ================= GET STUDENT FEES (With Registration Check) ================= */
const getStudentFees = async (req, res) => {
  try {
    const { id } = req.params;

    const studentRes = await db.query(
      "SELECT joining_date FROM students WHERE id = $1",
      [id]
    );

    const joiningDate = studentRes.rows[0]?.joining_date;

    const feeRes = await db.query(
      "SELECT * FROM fees WHERE student_id = $1",
      [id]
    );

    const fees = feeRes.rows;

    const today = new Date();

    /* =========================
       🔥 FIX: SAFE DATE PARSE
    ========================= */

    let isNewStudent = false;

    if (joiningDate) {
      let join;

      // 👉 handle DD/MM/YYYY format
      if (joiningDate.includes("/")) {
        const [day, month, year] = joiningDate.split("/");
        join = new Date(`${year}-${month}-${day}`);
      } else {
        join = new Date(joiningDate);
      }

      const diffDays = Math.floor(
        (today - join) / (1000 * 60 * 60 * 24)
      );

      if (diffDays < 30) {
        isNewStudent = true;
      }
    }

    /* =========================
       ✅ CHECK PAID THIS MONTH
    ========================= */

    const isPaidThisMonth = fees.some(f => {
      const fDate = new Date(f.payment_date);
      return (
        fDate.getMonth() === today.getMonth() &&
        fDate.getFullYear() === today.getFullYear() &&
        f.payment_status === "SUCCESS"
      );
    });

    /* =========================
       🚨 FINAL POPUP LOGIC
    ========================= */

    let showPopup = false;

    if (!isNewStudent && !isPaidThisMonth) {
      showPopup = true;
    }

    res.json({
      success: true,
      fees,
      showPopup,
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};
/* ================= GET ALL FEES (Admin History) ================= */
async function getAllFees(req, res) {
  try {

    const { session, month } = req.query;

    let query = `SELECT * FROM fees WHERE payment_status='SUCCESS'`;
    let params = [];

    if (session) {
      params.push(session);
      query += ` AND session = $${params.length}`;
    }

    if (month) {
      params.push(month);
      query += ` AND EXTRACT(MONTH FROM payment_date) = $${params.length}`;
    }

    query += ` ORDER BY payment_date DESC`;

    const { rows } = await db.query(query, params);

    res.json({
      success: true,
      fees: rows
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success:false });
  }
}
/* ================= ADD FEE (CASH) ================= */
async function addFee(req, res) {
  try {
    const { student_id, student_name, class_name, amount, payment_date, payment_time, status, payment_mode } = req.body;

    // ✅ Student ke session & stream fetch karo
    const studentRes = await db.query(
      "SELECT session, stream FROM students WHERE id = $1",
      [student_id]
    );
    if (studentRes.rows.length === 0)
      return res.status(404).json({ success: false, message: "Student not found" });

    const { session, stream } = studentRes.rows[0];

    // ✅ Fees table me insert karo
    await db.query(
      `INSERT INTO fees 
      (student_id, student_name, class_name, amount, payment_date, payment_time, status, payment_mode, payment_status, stream, session) 
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'SUCCESS',$9,$10)`,
      [student_id, student_name, class_name, amount, payment_date, payment_time, status || "On Time", payment_mode || "CASH", stream, session]
    );

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
}
/* ================= PHONEPE & OTHER CRUD ================= */
async function updateFee(req, res) {
    try {
        await db.query(`UPDATE fees SET amount=$1 WHERE id=$2`, [req.body.amount, req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false }); }
}

async function deleteFee(req, res) {
    try {
        await db.query("DELETE FROM fees WHERE id=$1", [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false }); }
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


const getFeeByClass = async (req, res) => {
  const { className } = req.params;
  try {
    const { data, error } = await supabase
      .from('fee_structure')
      .select('monthly_fee')
      .eq('class_name', className)
      .single();

    if (error) throw error;
    res.json({ success: true, monthly_fee: data.monthly_fee });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};



module.exports = {
    addFee,
    getStudentFees,
    getAllFees,
    updateFee,
    deleteFee,
     createPhonePePayment,
    phonePeCallback,
    getFeeByClass
};