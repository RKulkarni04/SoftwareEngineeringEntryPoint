// Import required libraries
const express = require("express");
const cors = require("cors");

// Connect to the database (this runs database.js)
require("./database");

// Import the API routes
const authRoutes = require("./routes/authRoutes");

// Create the Express application
const app = express();

// Middleware
app.use(cors());           // Allows frontend to communicate with backend
app.use(express.json());   // Allows server to read JSON request bodies

// Connect the routes under /api
app.use("/api", authRoutes);

// Test route to confirm server is running
app.get("/", (req, res) => {
    res.send("Student Login Backend is running");
});

// Start the server
const PORT = 3000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});