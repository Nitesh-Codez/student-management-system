const express = require("express");
const router = express.Router();

const {
  addHoliday,
  getHolidays,
} = require("../controllers/holidaysController");

router.post("/add", addHoliday);
router.get("/get", getHolidays);
// 2 only

module.exports = router;