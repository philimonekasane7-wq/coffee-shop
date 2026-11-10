const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// Hash the configured staff password
const passwordHashPromise = bcrypt.hash(
  process.env.STAFF_PASSWORD || "",
  10
);

// Staff login
async function login(req, res) {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        error: "Username and password are required."
      });
    }

    const passwordHash = await passwordHashPromise;

    const validUsername =
      username === process.env.STAFF_USERNAME;

    const validPassword = await bcrypt.compare(
      password,
      passwordHash
    );

    if (!validUsername || !validPassword) {
      return res.status(401).json({
        error: "Incorrect username or password."
      });
    }

    const token = jwt.sign(
      { username, role: "staff" },
      process.env.JWT_SECRET,
      { expiresIn: "8h" }
    );

    res.status(200).json({
      success: true,
      message: "Login successful.",
      token
    });

  } catch (error) {
    res.status(500).json({
      error: "Login failed."
    });
  }
}

module.exports = { login };