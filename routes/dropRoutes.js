const express = require("express");
const router = express.Router();
const dropController = require("../controllers/dropController");

// student drop apply
router.post("/apply-drop", dropController.applyDrop);

module.exports = router;