// ================= GET SUBMISSIONS BY TASK =================
async function getSubmissionsByTask(req, res) {
  try {
    const { task_title } = req.params;

    if (!task_title) {
      return res.status(400).json({
        success: false,
        message: "Task title is required",
      });
    }

    // 🔹 Join with students table to get student names
    const sql = `
      SELECT a.id, a.task_title, a.subject, a.class, a.file_path, a.status, s.name AS student_name
      FROM assignment_uploads a
      JOIN students s ON a.student_id = s.id
      WHERE a.task_title = $1
      ORDER BY a.uploaded_at DESC
    `;

    const { rows } = await db.query(sql, [task_title]);

    res.json({
      success: true,
      submissions: rows,
    });
  } catch (err) {
    console.error("FETCH SUBMISSIONS ERROR:", err.message);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
}

module.exports = {
  uploadAssignment,
  getAssignmentsByClass,
  deleteAssignment,
  getSubmissionsByTask, // 🆕 export
};
