require("dotenv").config();
const jwt = require("jsonwebtoken");
const token = jwt.sign(
  { id: 1, email: "mageshkumar.it@gmail.com" },
  process.env.JWT_SECRET,
  { expiresIn: "1h" },
);
console.log(token);
