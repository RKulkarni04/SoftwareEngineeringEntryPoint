const express = require("express");
const router = express.Router();

const {
  registerUser,
  loginUser,
  getProgress,
  getActivity,
  chatMessage,
  multiModelChat,
  getModels,
  getConversations,
  searchConversations,
  getMastery,
  createChat
} = require("../controllers/authController");

const authenticateToken = require("../middleware/authMiddleware");

// Auth routes
router.post("/register", registerUser);
router.post("/login", loginUser);

// Progress and activity routes
router.get("/progress/:id", authenticateToken, getProgress);
router.get("/activity/:id", authenticateToken, getActivity);

// Chat routes
router.post("/chats", authenticateToken, createChat);
router.post("/chat", authenticateToken, chatMessage);
router.post("/chat/multi", authenticateToken, multiModelChat);
router.get("/models", authenticateToken, getModels);
router.get("/conversations/search", authenticateToken, searchConversations);
router.get("/conversations/:id", authenticateToken, getConversations);
router.get("/mastery/:id", authenticateToken, getMastery);

module.exports = router;
