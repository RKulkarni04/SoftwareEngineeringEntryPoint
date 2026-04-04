
const express = require("express");
const router = express.Router();

const {
  registerUser,
  loginUser,
  getProgress,
  getActivity,
  chatMessage
} = require("../controllers/authController");

const authenticateToken = require("../middleware/authMiddleware");

router.post("/register", registerUser);
router.post("/login", loginUser);

router.get("/progress/:id", authenticateToken, getProgress);
router.get("/activity/:id", authenticateToken, getActivity);
router.post("/chat", authenticateToken, chatMessage);

module.exports = router;