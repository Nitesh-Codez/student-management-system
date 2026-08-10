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

router.post('/add',authMiddleware,adminMiddleware, addResult);
router.get('/all',authMiddleware,adminMiddleware, getAllResults);
router.get('/search',authMiddleware,getStudentResult);
router.put('/update/:id',authMiddleware,adminMiddleware, updateResult);

module.exports = router;