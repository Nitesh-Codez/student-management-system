const express = require("express");
const router = express.Router();
const chatController = require("../controllers/chatController");
const db = require("../db"); // ✅ YE MISSING THA, ISILIYE 500 ERROR AA RAHA THA

// Send message (text/image)
router.post("/send", chatController.uploadMiddleware.single("image"), chatController.sendMessage);

// Get chat between 2 users
router.get("/:user1/:user2", chatController.getChat);

// Get all students for chat selection
router.get("/students", async (req, res) => {
  try {
    const senderId = req.query.senderId;
    
    // Agar senderId null hai toh crash na ho, empty array jaye
    if (!senderId || senderId === 'undefined') {
        return res.json({ success: true, students: [] });
    }

    const result = await db.query(
      "SELECT id, name FROM students WHERE id != $1 ORDER BY name ASC",
      [senderId]
    );
    res.json({ success: true, students: result.rows });
  } catch (error) {
    console.error("Error fetching students route:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Admin: get all messages
router.get("/admin/all", chatController.getAllChats);

module.exports = router;