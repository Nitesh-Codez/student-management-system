const db = require("../db");

// ================= CREATE / ASSIGN CLASS =================
exports.assignClass = async (req, res) => {
  try {
    const {
      teacher_id,
      class_id,
      subject_id,
      class_start_date,
      class_end_date,
      start_time,
      end_time
    } = req.body;

    const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const dateObj = new Date(class_start_date);
    const day_of_week = days[dateObj.getDay()];

    const sql = `
      INSERT INTO teacher_assignments
      (teacher_id,class_name,subject_name,class_start_date,class_end_date,day_of_week,start_time,end_time)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    `;

    await db.query(sql, [
      teacher_id,
      class_id,
      subject_id,
      class_start_date,
      class_end_date,
      day_of_week,
      start_time,
      end_time
    ]);

    res.json({ success:true,message:"Class assigned ✅" });

  } catch (err) {
    res.status(500).json({ success:false,message:err.message });
  }
};

// ================= GET ALL =================
exports.getAssignments = async (req,res)=>{
  try{

    const sql=`
      SELECT ta.*,t.name teacher_name
      FROM teacher_assignments ta
      LEFT JOIN teachers t ON ta.teacher_id=t.id
      ORDER BY class_start_date,start_time
    `;

    const r=await db.query(sql);
    res.json(r.rows);

  }catch(err){
    res.status(500).json({success:false,message:err.message});
  }
};

// ================= UPDATE =================
exports.updateAssignment=async(req,res)=>{
 try{

  const {id}=req.params;
  const {
    teacher_id,
    class_id,
    subject_id,
    class_start_date,
    class_end_date,
    start_time,
    end_time
  }=req.body;

  const sql=`
   UPDATE teacher_assignments SET
    teacher_id=COALESCE($1,teacher_id),
    class_name=COALESCE($2,class_name),
    subject_name=COALESCE($3,subject_name),
    class_start_date=COALESCE($4,class_start_date),
    class_end_date=COALESCE($5,class_end_date),
    start_time=COALESCE($6,start_time),
    end_time=COALESCE($7,end_time)
   WHERE id=$8
  `;

  await db.query(sql,[
    teacher_id,
    class_id,
    subject_id,
    class_start_date,
    class_end_date,
    start_time,
    end_time,
    id
  ]);

  res.json({success:true,message:"Updated ✅"});

 }catch(err){
  res.status(500).json({success:false,message:err.message});
 }
};

// ================= DELETE =================
exports.deleteAssignment=async(req,res)=>{
 try{
  await db.query("DELETE FROM teacher_assignments WHERE id=$1",[req.params.id]);
  res.json({success:true});
 }catch(err){
  res.status(500).json({success:false,message:err.message});
 }
};

// ================= TEACHER =================
exports.getTeacherLectures=async(req,res)=>{
 try{

 const sql=`
  SELECT * FROM teacher_assignments
  WHERE teacher_id=$1
  ORDER BY class_start_date
 `;

 const r=await db.query(sql,[req.params.teacher_id]);
 res.json(r.rows);

 }catch(err){
  res.status(500).json({success:false,message:err.message});
 }
};

// ================= STUDENT (weekly + date control) =================
exports.getStudentLectures = async (req, res) => {
  try {
    const { class_name, day } = req.params;
    const today = new Date().toISOString().split("T")[0];

    const sql = `
      SELECT ta.*, t.name teacher_name, t.teacher_code, t.profile_photo
      FROM teacher_assignments ta
      LEFT JOIN teachers t ON ta.teacher_id = t.id
      WHERE ta.class_name = $1
      AND ta.day_of_week = $2
      AND $3 BETWEEN ta.class_start_date AND ta.class_end_date
      ORDER BY ta.start_time
    `;

    const r = await db.query(sql, [class_name, day, today]);

    // ✅ Yaha object me wrap kar do
    res.json({
      success: true,
      assignments: r.rows
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

