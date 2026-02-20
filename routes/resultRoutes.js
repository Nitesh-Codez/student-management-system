const express = require('express');
const router = express.Router();
const { addResult } = require('../controllers/resultController');

// Frontend se axios.post(`${API_URL}/api/results/add`, ...) yahan aayega
router.post('/add', addResult);

module.exports = router;