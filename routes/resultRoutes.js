const express = require('express');
const router = express.Router();

const {
    addResult,
    getAllResults,
    getStudentResult,
    updateResult
} = require('../controllers/resultController');

router.post('/add', addResult);
router.get('/all', getAllResults);
router.get('/search', getStudentResult);
router.put('/update/:id', updateResult);

module.exports = router;