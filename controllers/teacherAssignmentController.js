const db = require("../db");

// ================= ASSIGN CLASS =================
exports.assignClass = async (req, res) => {
  try {
    const {
      teacher_id,
      class_id,
      subject_id,
      class_date,
      start_time,
      end_time,
      is_recurring = true,
      repeat_until,
      special = false   // 👈 SPECIAL FLAG
    } = req.body;

    if (!class_date)
      return res.status(400).json({ success:false,message:"class_date required" });

    const finalRepeatUntil = repeat_until || class_date;

    const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const day_of_week = days[new Date(class_date).getDay()];

    // ================= CONFLICT CHECK =================
    const conflictSql = `
      SELECT id FROM teacher_assignments
      WHERE teacher_id=$1
      AND day_of_week=$2
      AND start_time=$3
      AND (
          $4 BETWEEN class_date AND repeat_until
          OR repeat_until IS NULL
      )
    `;

    const conflict = await db.query(conflictSql,[
      teacher_id,
      day_of_week,
      start_time,
      class_date
    ]);

    // ❌ BLOCK ONLY IF NOT SPECIAL
    if(conflict.rows.length && !special){
      return res.status(400).json({
        success:false,
        message:"Slot already occupied ❌"
      });
    }

    // ================= INSERT =================
    await db.query(`
      INSERT INTO teacher_assignments
      (teacher_id,class_name,subject_name,class_date,day_of_week,start_time,end_time,is_recurring,repeat_until)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    `,[
      teacher_id,
      class_id,
      subject_id,
      class_date,
      day_of_week,
      start_time,
      end_time,
      is_recurring,
      finalRepeatUntil
    ]);

    res.json({
      success:true,
      message: special
        ? "Special class assigned to ALL classes ✅"
        : "Class assigned ✅"
    });

  } catch(err){
    console.log(err);
    res.status(500).json({success:false,message:err.message});
  }
};

// ================= GET ALL =================
exports.getAssignments = async (req,res)=>{
  try{
    const result = await db.query(`
      SELECT ta.*,t.name AS teacher_name
      FROM teacher_assignments ta
      LEFT JOIN teachers t ON ta.teacher_id=t.id
      ORDER BY ta.class_date,start_time
    `);

    res.json(result.rows);

  }catch(err){
    res.status(500).json({success:false,message:err.message});
  }
};

// ================= STUDENT LECTURES BY DATE =================
exports.getStudentLectures = async (req,res)=>{
  try{
    const { class_name, date } = req.params;

    const days=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const day=days[new Date(date).getDay()];

    const sql=`
    SELECT ta.*,t.name AS teacher_name,t.profile_photo
    FROM teacher_assignments ta
    LEFT JOIN teachers t ON ta.teacher_id=t.id
    WHERE ta.class_name=$1
    AND ta.day_of_week=$3
    AND $2 >= ta.class_date
    AND ($2 <= ta.repeat_until OR ta.repeat_until IS NULL)
    ORDER BY ta.start_time
    `;

    const result=await db.query(sql,[class_name,date,day]);

    res.json({success:true,assignments:result.rows});

  }catch(err){
    res.status(500).json({success:false,message:err.message});
  }
};

// ================= TEACHER LECTURES =================
exports.getTeacherLectures = async (req,res)=>{
  try{
    const { teacher_id }=req.params;

    const result=await db.query(`
      SELECT ta.*,t.name AS teacher_name,t.profile_photo
      FROM teacher_assignments ta
      LEFT JOIN teachers t ON ta.teacher_id=t.id
      WHERE ta.teacher_id=$1
      ORDER BY class_date,start_time
    `,[teacher_id]);

    res.json({success:true,assignments:result.rows});

  }catch(err){
    res.status(500).json({success:false,message:err.message});
  }
};

// ================= UPDATE =================
exports.updateAssignment = async (req,res)=>{
  try{
    const { id }=req.params;

    const {
      teacher_id,
      class_id,
      subject_id,
      class_date,
      start_time,
      end_time,
      is_recurring,
      repeat_until
    }=req.body;

    const sql=`
    UPDATE teacher_assignments SET
    teacher_id=COALESCE($1,teacher_id),
    class_name=COALESCE($2,class_name),
    subject_name=COALESCE($3,subject_name),
    class_date=COALESCE($4,class_date),
    start_time=COALESCE($5,start_time),
    end_time=COALESCE($6,end_time),
    is_recurring=COALESCE($7,is_recurring),
    repeat_until=COALESCE($8,repeat_until)
    WHERE id=$9
    `;

    const result=await db.query(sql,[
      teacher_id,class_id,subject_id,class_date,start_time,end_time,is_recurring,repeat_until,id
    ]);

    if(!result.rowCount)
      return res.status(404).json({success:false,message:"Not found"});

    res.json({success:true,message:"Updated ✅"});

  }catch(err){
    res.status(500).json({success:false,message:err.message});
  }
};

// ================= DELETE =================
exports.deleteAssignment = async (req,res)=>{
  try{
    const { id }=req.params;

    const result=await db.query(`DELETE FROM teacher_assignments WHERE id=$1`,[id]);

    if(!result.rowCount)
      return res.status(404).json({success:false,message:"Not found"});

    res.json({success:true,message:"Deleted ✅"});

  }catch(err){
    res.status(500).json({success:false,message:err.message});
  }
};


// ================= SUSPEND ALL CLASSES FOR A DAY =================
exports.suspendDay = async (req, res) => {
  try {
    const { date } = req.body;

    if (!date) {
      return res.status(400).json({ success: false, message: "Date is required" });
    }

    // Is query se us specific date par hone wali saari classes delete ho jayengi
    // Note: Agar recurring classes hain, toh unhe 'is_recurring=false' karke handle karna hota hai, 
    // par simple approach ke liye hum us date ke entries delete kar rahe hain.
    const result = await db.query(
      `DELETE FROM teacher_assignments WHERE class_date = $1`,
      [date]
    );

    res.json({
      success: true,
      message: `Total ${result.rowCount} classes suspended for ${date} ✅`,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};





// Add holiday — all classes / selected classes / date range
exports.addHoliday = async (req, res) => {
  try {
    const {
      title,
      description,
      class_names,
      start_date,
      end_date
    } = req.body;

    if (!title || !start_date || !end_date) {
      return res.status(400).json({
        message: "title, start_date and end_date are required"
      });
    }

    const result = await pool.query(
      `INSERT INTO public.holidays
       (title, description, class_names, start_date, end_date)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        title,
        description || null,
        class_names?.length ? class_names : null,
        start_date,
        end_date
      ]
    );

    res.status(201).json({
      message: "Holiday added successfully",
      holiday: result.rows[0]
    });

  } catch (error) {
    console.error("Add holiday error:", error);
    res.status(500).json({
      message: "Failed to add holiday"
    });
  }
};


// Get holidays
exports.getHolidays = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT *
       FROM public.holidays
       ORDER BY start_date DESC`
    );

    res.json(result.rows);

  } catch (error) {
    console.error("Get holidays error:", error);
    res.status(500).json({
      message: "Failed to fetch holidays"
    });
  }
};


// Delete holiday
exports.deleteHoliday = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `DELETE FROM public.holidays
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        message: "Holiday not found"
      });
    }

    res.json({
      message: "Holiday deleted successfully"
    });

  } catch (error) {
    console.error("Delete holiday error:", error);
    res.status(500).json({
      message: "Failed to delete holiday"
    });
  }
};

