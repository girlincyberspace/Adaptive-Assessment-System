const express = require("express");
const router = express.Router();
const User = require("../models/User");
const { authenticateToken } = require("../utils/jwt");

// Get user stats
router.get("/:id/stats", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ msg: "User not found" });

    // Example stats — replace with your own logic
    const stats = {
      id: user._id,
      username: user.username,
      email: user.email,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin,
      // Add more: posts count, activity, etc.
    };

    res.json(stats);
  } catch (err) {
    res.status(500).json({ msg: "Server error", error: err.message });
  }
});

module.exports = router;
