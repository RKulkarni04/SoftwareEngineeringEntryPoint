const express = require("express");
const router = express.Router();

const {
    registerUser,
    loginUser,
    getProgress,
    getActivity
} = require("../controllers/authController");

const authenticateToken = require("../middleware/authMiddleware");

router.post("/register", registerUser);
router.post("/login", loginUser);

router.get("/progress", authenticateToken, getProgress);
router.get("/activity", authenticateToken, getActivity);

module.exports = router;
