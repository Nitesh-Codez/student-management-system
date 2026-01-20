const express = require("express");
const router = express.Router();
const chatController = require("../controllers/chatController");
const db = require("../db");

router.post("/send", chatController.uploadMiddleware.single("image"), chatController.sendMessage);
router.get("/:user1/:user2", chatController.getChat);
router.delete("/delete/:id", chatController.deleteMessage);
router.get("/admin/all", chatController.getAllChats);

router.get("/students", async (req, res) => {
  try {
    const { senderId } = req.query;
    if (!senderId || senderId === 'undefined') return res.json({ success: true, students: [] });

    const result = await db.query(
      "SELECT id, name, profile_photo FROM students WHERE id != $1 ORDER BY name ASC",
      [senderId]
    );
    res.json({ success: true, students: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;