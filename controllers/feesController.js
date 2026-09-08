const db = require("../db");
const crypto = require("crypto");
const axios = require("axios");

/* ================= CONFIG ================= */
const MERCHANT_ID = process.env.PHONEPE_MID;
const SALT_KEY = process.env.PHONEPE_SALT;
const SALT_INDEX = "1";
const PHONEPE_BASE_URL = "https://api-preprod.phonepe.com/apis/pg-sandbox";

//=========================================================================
const getStudentFees = async (req, res) => {
  try {
    const { id } = req.params;

    // Fetch fee records for the specific student
    const feeRes = await db.query(
      `SELECT *
       FROM fees
       WHERE student_id = $1
       ORDER BY payment_date DESC, id DESC`,
      [id]
    );

    const fees = feeRes.rows;

    // Group fees month-wise based on fee_month column
    const monthlyFees = {};

    fees.forEach((fee) => {
      const month = fee.fee_month || "Unassigned";

      if (!monthlyFees[month]) {
        monthlyFees[month] = {
          fee_month: month,
          total_amount: 0,
          payments: [],
        };
      }

      monthlyFees[month].total_amount += Number(fee.amount);
      monthlyFees[month].payments.push(fee);
    });

    res.json({
      success: true,
      fees,
      monthlyFees: Object.values(monthlyFees),
    });

  } catch (err) {
    console.error("GET STUDENT FEES ERROR:", err);

    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};
/* =========================================================
   GET ALL FEES - ADMIN HISTORY
========================================================= */

async function getAllFees(req, res) {
  try {

    const {
      session,
      month,
      year
    } = req.query;

    let query = `
      SELECT *
      FROM fees
      WHERE payment_status = 'SUCCESS'
    `;

    let params = [];

    /* ================= SESSION ================= */

    if (session) {
      params.push(session);

      query += `
        AND session = $${params.length}
      `;
    }

    /* ================= FEE MONTH ================= */

    /*
      Admin agar August 2026 select kare:

      month = August
      year = 2026

      Database:
      fee_month = "August 2026"

      payment_date chahe September ho,
      phir bhi August mein dikhega.
    */

    if (month && year) {

      const feeMonth = `${month} ${year}`;

      params.push(feeMonth);

      query += `
        AND fee_month = $${params.length}
      `;
    }

    query += `
      ORDER BY payment_date DESC, id DESC
    `;

    const { rows } = await db.query(
      query,
      params
    );

    res.json({
      success: true,
      fees: rows,
    });

  } catch (err) {

    console.error(
      "GET ALL FEES ERROR:",
      err
    );

    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
}



/* ========================================================= 
   ADD FEE (With fee_month and explicit session support)
========================================================= */ 
async function addFee(req, res) { 
  try { 
    const { 
      student_id, 
      student_name, 
      class_name, 
      amount, 
      fee_month, 
      payment_date, 
      payment_time, 
      status, 
      payment_mode, 
      session: reqSession, // Request body se optional session
    } = req.body; 

    /* ================= VALIDATION ================= */ 
    if (!student_id || !amount || !fee_month || !payment_date) { 
      return res.status(400).json({ 
        success: false, 
        message: "student_id, amount, fee_month and payment_date are required", 
      }); 
    } 

    /* ================= STUDENT ================= */ 
    const studentRes = await db.query( 
      `SELECT session, stream FROM students WHERE id = $1`, 
      [student_id] 
    ); 

    if (studentRes.rows.length === 0) { 
      return res.status(404).json({ 
        success: false, 
        message: "Student not found", 
      }); 
    } 

    const studentData = studentRes.rows[0]; 
    // Agar request body mein session bheji hai toh wo use hogi, nahi toh students table wali session fallback banegi
    const finalSession = reqSession || studentData.session; 
    const stream = studentData.stream; 

    /* ================= INSERT ================= */ 
    const result = await db.query( 
      `INSERT INTO fees 
      ( 
        student_id, 
        student_name, 
        class_name, 
        amount, 
        fee_month, 
        payment_date, 
        payment_time, 
        status, 
        payment_mode, 
        payment_status, 
        stream, 
        session 
      ) 
      VALUES 
      ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'SUCCESS', $10, $11) 
      RETURNING *`, 
      [ 
        student_id, 
        student_name, 
        class_name, 
        amount, 
        fee_month, 
        payment_date, 
        payment_time || null, 
        status || "On Time", 
        payment_mode || "CASH", 
        stream, 
        finalSession, 
      ] 
    ); 

    res.json({ 
      success: true, 
      message: "Fee added successfully", 
      fee: result.rows[0], 
    }); 

  } catch (err) { 
    console.error("ADD FEE ERROR:", err); 
    res.status(500).json({ 
      success: false, 
      message: err.message, 
    }); 
  } 
} 

/* ========================================================= 
   UPDATE FEE (With session and fee_month support)
========================================================= */ 
async function updateFee(req, res) { 
  try { 
    const { 
      amount, 
      class_name, 
      fee_month, 
      payment_date, 
      payment_time, 
      status, 
      payment_mode, 
      session, 
    } = req.body; 

    if (!amount || !fee_month || !payment_date) { 
      return res.status(400).json({ 
        success: false, 
        message: "amount, fee_month and payment_date are required", 
      }); 
    } 

    const result = await db.query( 
      `UPDATE fees 
       SET 
         amount = $1, 
         class_name = $2, 
         fee_month = $3, 
         payment_date = $4, 
         payment_time = $5, 
         status = $6, 
         payment_mode = $7,
         session = COALESCE($8, session)
       WHERE id = $9 
       RETURNING *`, 
      [ 
        amount, 
        class_name, 
        fee_month, 
        payment_date, 
        payment_time || null, 
        status || "On Time", 
        payment_mode || "CASH", 
        session || null, 
        req.params.id, 
      ] 
    ); 

    if (result.rows.length === 0) { 
      return res.status(404).json({ 
        success: false, 
        message: "Fee record not found", 
      }); 
    } 

    res.json({ 
      success: true, 
      message: "Fee updated successfully", 
      fee: result.rows[0], 
    }); 

  } catch (err) { 
    console.error("UPDATE FEE ERROR:", err); 
    res.status(500).json({ 
      success: false, 
      message: err.message, 
    }); 
  } 
} 

/* ========================================================= 
   DELETE FEE 
========================================================= */ 
async function deleteFee(req, res) { 
  try { 
    const result = await db.query( 
      `DELETE FROM fees WHERE id = $1 RETURNING *`, 
      [req.params.id] 
    ); 

    if (result.rows.length === 0) { 
      return res.status(404).json({ 
        success: false, 
        message: "Fee record not found", 
      }); 
    } 

    res.json({ 
      success: true, 
      message: "Fee deleted successfully", 
    }); 

  } catch (err) { 
    console.error("DELETE FEE ERROR:", err); 
    res.status(500).json({ 
      success: false, 
      message: err.message, 
    }); 
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


//Admin
/* ================= GET SESSION FEES MONTH-WISE (ADMIN) ================= */
const getSessionFeesByMonth = async (req, res) => {
  try {
    const { session } = req.query;

    if (!session) {
      return res.status(400).json({
        success: false,
        message: "Session is required",
      });
    }

    // Session ke saare successful fee records
    const { rows } = await db.query(
      `SELECT *
       FROM fees
       WHERE session = $1
         AND payment_status = 'SUCCESS'
       ORDER BY payment_date ASC, payment_time ASC`,
      [session]
    );

    // Academic session ke months
    const months = [
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
      "January",
      "February",
      "March",
    ];

    // Month-wise grouping
    const monthlyFees = {};

    months.forEach((month) => {
      monthlyFees[month] = [];
    });

    rows.forEach((fee) => {
      if (!fee.payment_date) return;

      const date = new Date(fee.payment_date);
      const monthName = date.toLocaleString("en-US", {
        month: "long",
      });

      if (monthlyFees[monthName]) {
        monthlyFees[monthName].push(fee);
      }
    });

    // Har month ka total
    const result = months.map((month) => ({
      month,
      total_records: monthlyFees[month].length,
      total_amount: monthlyFees[month].reduce(
        (sum, fee) => sum + Number(fee.amount || 0),
        0
      ),
      fees: monthlyFees[month],
    }));

    res.json({
      success: true,
      session,
      months: result,
    });
  } catch (err) {
    console.error("Session month-wise fee error:", err);

    res.status(500).json({
      success: false,
      message: "Failed to fetch session fees",
    });
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
    getFeeByClass,
    getSessionFeesByMonth
};