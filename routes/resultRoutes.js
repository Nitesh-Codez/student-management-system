const express = require('express');
const router = express.Router();

//Middlewares
const authMiddleware = require("../middlewares/authMiddleware");
const adminMiddleware = require("../middlewares/adminMiddleware");

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