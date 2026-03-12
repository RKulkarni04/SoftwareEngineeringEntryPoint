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

router.get("/progress/:id", authenticateToken, getProgress);
router.get("/activity/:id", authenticateToken, getActivity);

module.exports = router;