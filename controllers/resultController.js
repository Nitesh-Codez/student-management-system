const pool = require('../db'); // Aapka Postgres connection pool

const addResult = async (req, res) => {
    try {
        const { 
            student, 
            cls, 
            term, 
            marks, 
            percentage, 
            totalMarks, 
            obtainedMarks 
        } = req.body;

        // Validation
        if (!student || !cls || !marks) {
            return res.status(400).json({ message: "Missing required fields" });
        }

        const query = `
            INSERT INTO student_results 
            (student_name, class, exam_term, marks, obtained_marks, total_max_marks, percentage) 
            VALUES ($1, $2, $3, $4, $5, $6, $7) 
            RETURNING *;
        `;

        const values = [
            student, 
            cls, 
            term, 
            JSON.stringify(marks), // Marks object ko string bana kar save karenge
            obtainedMarks, 
            totalMarks, 
            percentage
        ];

        const result = await pool.query(query, values);

        res.status(201).json({
            message: "Result Saved Successfully ✅",
            data: result.rows[0]
        });

    } catch (error) {
        console.error("Database Error:", error);
        res.status(500).json({ message: "Error saving result to database" });
    }
};

module.exports = { addResult };