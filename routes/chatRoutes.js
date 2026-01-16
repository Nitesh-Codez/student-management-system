const express = require("express");
const router = express.Router();
const chatController = require("../controllers/chatController");

// Send message (text/image) - No middleware
router.post("/send", chatController.uploadMiddleware.single("image"), chatController.sendMessage);

// Get chat between 2 users - No middleware
router.get("/:user1/:user2", chatController.getChat);

// Get all students for chat selection - No middleware
router.get("/students", async (req, res) => {
  try {
    const senderId = req.query.senderId;
    const result = await db.query(
      "SELECT id, name FROM students WHERE id != $1",
      [senderId]
    );
    res.json({ success: true, students: result.rows });
  } catch (error) {
    console.error("Error fetching students:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Admin: get all messages - No middleware
router.get("/admin/all", chatController.getAllChats);

module.exports = router;
