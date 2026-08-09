const express = require("express");
const router = express.Router();
const dropController = require("../controllers/dropController");

//Middlewares
const authMiddleware = require("../middlewares/authMiddleware");
const adminMiddleware = require("../middlewares/adminMiddleware");

// student drop apply
router.post("/apply-drop", dropController.applyDrop);
router.get("/my-drop-requests", dropController.getMyDropRequests);

module.exports = router;