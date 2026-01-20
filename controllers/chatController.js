const db = require("../db");
const cloudinary = require("cloudinary").v2;
const multer = require("multer");

const storage = multer.diskStorage({});
const upload = multer({ storage });

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET,
});

// 1. Send Message
exports.sendMessage = async (req, res) => {
  try {
    const { from_user, to_user, text } = req.body;
    let image_url = null;

    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path, { folder: "chat_images" });
      image_url = result.secure_url;
    }

    const msg = await db.query(
      "INSERT INTO messages (from_user, to_user, text, image_url, is_read, timestamp) VALUES ($1,$2,$3,$4, FALSE, NOW()) RETURNING *",
      [from_user, to_user, text || null, image_url]
    );

    res.json({ success: true, message: msg.rows[0] });
  } catch (err) {
    console.error("Send Error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// 2. Get Chat & Mark as Read
exports.getChat = async (req, res) => {
  try {
    const { user1, user2 } = req.params;
    
    // Mark messages as read when user opens the chat
    await db.query(
      "UPDATE messages SET is_read = TRUE WHERE from_user = $1 AND to_user = $2",
      [user2, user1]
    );

    const msgs = await db.query(
      "SELECT * FROM messages WHERE (from_user=$1 AND to_user=$2) OR (from_user=$2 AND to_user=$1) ORDER BY timestamp ASC",
      [user1, user2]
    );
    res.json({ success: true, messages: msgs.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// 3. Delete Message
exports.deleteMessage = async (req, res) => {
  try {
    const { id } = req.params;
    await db.query("DELETE FROM messages WHERE id = $1", [id]);
    res.json({ success: true, message: "Message deleted successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Delete error" });
  }
};

exports.getAllChats = async (req, res) => {
  try {
    const msgs = await db.query("SELECT * FROM messages ORDER BY timestamp ASC");
    res.json({ success: true, messages: msgs.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.uploadMiddleware = upload;