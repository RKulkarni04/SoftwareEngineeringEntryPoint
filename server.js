const express = require("express");
const cors = require("cors");
const path = require("path");

// Connect to the database
require("./database");

// Import API routes
const authRoutes = require("./routes/authRoutes");

// Create app
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Serve frontend files
app.use(express.static(path.join(__dirname, "frontend")));

// API routes
app.use("/api", authRoutes);

// Root route
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "frontend", "landing.html"));
});

// Start server
const PORT = 3000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
