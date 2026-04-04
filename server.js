// Import required libraries
const express = require("express");
const cors = require("cors");
const path = require("path"); // Added to help build file paths correctly

// Connect to the database (this runs database.js)
require("./database");

// Import the API routes
const authRoutes = require("./routes/authRoutes");

// Create the Express application
const app = express();

// Middleware
app.use(cors());           // Allows frontend to communicate with backend
app.use(express.json());   // Allows server to read JSON request bodies

// Serve all files in the frontend/ folder as static files
// This allows the browser to access landing.html, chat.html, signup.html etc.
app.use(express.static(path.join(__dirname, "frontend")));

// Connect the routes under /api
app.use("/api", authRoutes);

// Load the landing page when user visits the root URL (localhost:3000)
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "frontend", "landing.html"));
});

// Start the server
const PORT = 3000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});