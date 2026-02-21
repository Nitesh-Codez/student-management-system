const pool = require('../db');

// 1. ADD RESULT
const addResult = async (req, res) => {
    try {
        const { student, cls, term, marks, percentage, totalMarks, obtainedMarks } = req.body;

        if (!student || !cls || !marks)
            return res.status(400).json({ message: "Missing fields" });

        const query = `
            INSERT INTO student_results 
            (student_name, class, exam_term, marks, obtained_marks, total_max_marks, percentage) 
            VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *;
        `;

        const values = [
            student,
            cls,
            term,
            JSON.stringify(marks),
            obtainedMarks,
            totalMarks,
            percentage
        ];

        const result = await pool.query(query, values);

        res.status(201).json({
            message: "Saved ✅",
            data: result.rows[0]
        });

    } catch (error) {
        res.status(500).json({ message: "Error saving result", error });
    }
};


// 2. GET ALL RESULTS
const getAllResults = async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM student_results ORDER BY created_at DESC'
        );

        res.status(200).json(result.rows);

    } catch (error) {
        res.status(500).json({ message: "Error fetching all results" });
    }
};


// 3. GET SINGLE STUDENT RESULT (FIXED ✅)
const getStudentResult = async (req, res) => {
    try {
        const { name, cls } = req.query;

        if (!name)
            return res.status(400).json({ message: "Student name required" });

        let query = `
            SELECT * FROM student_results 
            WHERE student_name = $1
        `;

        let values = [name];

        if (cls) {
            query += ` AND class = $2`;
            values.push(cls);
        }

        const result = await pool.query(query, values);

        if (result.rows.length === 0)
            return res.status(404).json({ message: "No results found" });

        res.status(200).json(result.rows);

    } catch (error) {
        res.status(500).json({ message: "Server error", error });
    }
};


// 4. UPDATE RESULT
const updateResult = async (req, res) => {
    try {
        const { id } = req.params;
        const { marks, percentage, totalMarks, obtainedMarks, term } = req.body;

        const query = `
            UPDATE student_results 
            SET marks = $1, percentage = $2, 
                total_max_marks = $3, obtained_marks = $4, exam_term = $5
            WHERE id = $6 RETURNING *;
        `;

        const values = [
            JSON.stringify(marks),
            percentage,
            totalMarks,
            obtainedMarks,
            term,
            id
        ];

        const result = await pool.query(query, values);

        if (result.rows.length === 0)
            return res.status(404).json({ message: "Result not found" });

        res.status(200).json({
            message: "Updated Successfully ✅",
            data: result.rows[0]
        });

    } catch (error) {
        res.status(500).json({ message: "Error updating result" });
    }
};


module.exports = {
    addResult,
    getAllResults,
    getStudentResult,
    updateResult
};