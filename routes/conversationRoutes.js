const express = require("express");
const router = express.Router();

const conversationController = require("../controllers/conversationController");
const authenticateToken = require("../middleware/authMiddleware");

router.post("/conversations", authenticateToken, conversationController.createConversation);
router.get("/conversations", authenticateToken, conversationController.listConversations);
router.get("/conversations/search", authenticateToken, conversationController.searchConversations);
router.get("/conversations/:id/messages", authenticateToken, conversationController.getMessages);
router.post("/conversations/:id/messages", authenticateToken, conversationController.postMessage);

module.exports = router;
