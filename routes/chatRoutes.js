const express = require("express");
const router = express.Router();
const chatController = require("../controllers/chatController");

// Send message (text/image)
router.post(
  "/send",
  chatController.uploadMiddleware.single("image"),
  chatController.sendMessage
);

// Get chat between 2 users
router.get("/:user1/:user2", chatController.getChat);

// Admin: get all messages
router.get("/admin/all", chatController.getAllChats);

module.exports = router;
