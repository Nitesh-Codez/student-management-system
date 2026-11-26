
const express = require("express");
const router = express.Router();

const admin = require("../controllers/adminVivaController");

router.post("/create", admin.createViva);

router.get("/all", admin.getAllVivas);

router.get("/:id", admin.getVivaById);

router.put("/:id", admin.updateViva);

router.patch("/:id/status", admin.toggleVivaStatus);

router.delete("/:id", admin.deleteViva);

router.get("/:id/results", admin.getVivaResults);

module.exports = router;
