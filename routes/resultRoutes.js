const express = require('express');
const router = express.Router();
const { 
    addResult, 
    getAllResults, 
    getStudentResult, 
    updateResult 
} = require('../controllers/resultController');

// Teacher/Admin: Result save karne ke liye
router.post('/add', addResult);

// Admin: Saare results dekhne ke liye
router.get('/all', getAllResults);

// Student: Apna result dekhne ke liye (Frontend: axios.get(`/api/results/search?name=Raunak&cls=7th`))
router.get('/search', getStudentResult);

// Admin/Teacher: Result edit karne ke liye
router.put('/update/:id', updateResult);

module.exports = router;