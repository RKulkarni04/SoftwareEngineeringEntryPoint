const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");

const {
    registerUser,
    loginUser,
    getProgress,
    getActivity,
    chatMessage,
    getConversations,
    searchConversations,
    setup2FA,
    enable2FA,
    disable2FA,
    requestPasswordReset,
    resetPassword,
    startCASLogin,
    casCallback
} = require("../controllers/authController");

const authenticateToken = require("../middleware/authMiddleware");

// Rate limiter: max 10 login attempts per IP per 15 minutes
const loginRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { error: "Too many login attempts from this IP. Please try again in 15 minutes." },
    standardHeaders: true,
    legacyHeaders: false
});

// Rate limiter for password reset requests (max 5 per hour per IP)
const resetRateLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    message: { error: "Too many password reset requests. Please try again later." },
    standardHeaders: true,
    legacyHeaders: false
});

// Rutgers CAS routes
router.get("/auth/cas", startCASLogin);
router.get("/auth/cas/callback", casCallback);

// Local auth routes
router.post("/register", registerUser);
router.post("/login", loginRateLimiter, loginUser);

// Password reset routes
router.post("/password-reset/request", resetRateLimiter, requestPasswordReset);
router.post("/password-reset/confirm", resetPassword);

// 2FA routes (require auth)
router.post("/2fa/setup", authenticateToken, setup2FA);
router.post("/2fa/enable", authenticateToken, enable2FA);
router.post("/2fa/disable", authenticateToken, disable2FA);

// Progress and activity
router.get("/progress/:id", authenticateToken, getProgress);
router.get("/activity/:id", authenticateToken, getActivity);

// Chat
router.post("/chat", authenticateToken, chatMessage);
router.get("/conversations/:id", authenticateToken, getConversations);
router.get("/conversations/search", authenticateToken, searchConversations);

module.exports = router;
