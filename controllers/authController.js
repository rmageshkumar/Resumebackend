const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/userModel");
const {
  sendActivationEmail,
  sendPasswordResetEmail,
} = require("../config/mailer");
const { verifyCaptcha } = require("../config/captcha");

exports.register = async (req, res) => {
  const { name, email, password, captchaToken } = req.body;

  console.log("reg request", req.body);
  // const isCaptchaValid = await verifyCaptcha(captchaToken);
  // if (!isCaptchaValid)
  //   return res.status(400).json({ message: "Invalid captcha" });
  const existingUser = await User.findUserByEmail(email);
  if (existingUser)
    return res.status(400).json({ message: "User already exists" });

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  const activationToken = jwt.sign({ email }, process.env.JWT_SECRET, {
    expiresIn: "1d",
  });
  await sendActivationEmail(email, activationToken);

  await User.createUser(name, email, passwordHash);
  res.json({
    message: "Registration successful. Check email for activation link.",
  });
};

exports.login = async (req, res) => {
  // const { email, password, captchaToken } = req.body;
  const { email, password } = req.body;
  console.log("Processing login for:", email);

  const user = await User.findUserByEmail(email);

  console.log("User found:", user);
  //const isCaptchaValid = await verifyCaptcha(captchaToken);
  // if (!isCaptchaValid)
  //   return res.status(400).json({ message: "Invalid captcha" });
  if (!user) {
    console.log("User not found:", email);
    return res.status(400).json({ message: "Invalid email or password" });
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    console.log("Password mismatch for:", email);
    return res.status(400).json({ message: "Invalid email or password" });
  }

  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
    expiresIn: "1d",
  });

  console.log("Login successful for:", email);
  const { password: _userPassword, ...userWithoutPassword } = user;
  return res.json({
    token,
    user: userWithoutPassword,
  });
};

// Add new profile update endpoint
exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, bio, location, phone, website, profileImage } = req.body;

    // Validate input
    if (!name) {
      return res.status(400).json({ message: "Name is required" });
    }

    // Update user profile
    await User.updateUserProfile(userId, {
      name,
      bio,
      location,
      phone,
      website,
      profileImage,
    });

    // Get updated user data
    const updatedUser = await User.findUserById(userId);

    // Remove sensitive information
    const { password, ...userWithoutPassword } = updatedUser;

    console.log(`Profile updated for user ID: ${userId}`);
    res.json({
      message: "Profile updated successfully",
      user: userWithoutPassword,
    });
  } catch (error) {
    console.error("Error updating profile:", error);
    res
      .status(500)
      .json({ message: "Failed to update profile", error: error.message });
  }
};

// Add password update endpoint
exports.updatePassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    // Validate input
    if (!currentPassword || !newPassword) {
      return res
        .status(400)
        .json({ message: "Current and new passwords are required" });
    }

    // Get user with password
    const user = await User.findUserById(userId);

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    // Update password
    await User.updateUserPassword(userId, passwordHash);

    console.log(`Password updated for user ID: ${userId}`);
    res.json({ message: "Password updated successfully" });
  } catch (error) {
    console.error("Error updating password:", error);
    res
      .status(500)
      .json({ message: "Failed to update password", error: error.message });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    console.log("Processing forgot password for:", email);

    const user = await User.findUserByEmail(email);
    if (!user) {
      // Don't reveal if the user exists for security
      return res.json({
        message:
          "If an account with that email exists, a password reset link has been sent.",
      });
    }

    // Generate reset token
    const resetToken = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });
    const expiresAt = new Date(Date.now() + 3600000); // 1 hour from now

    // Save reset token to database
    await User.updateUserResetToken(user.id, resetToken, expiresAt);

    // Send reset email
    await sendPasswordResetEmail(email, resetToken);

    console.log("Password reset email sent to:", email);
    res.json({
      message:
        "If an account with that email exists, a password reset link has been sent.",
    });
  } catch (error) {
    console.error("Error in forgot password:", error);
    res
      .status(500)
      .json({ message: "Failed to process password reset request" });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    console.log("Processing password reset with token");

    const user = await User.findUserByResetToken(token);
    if (!user) {
      return res
        .status(400)
        .json({ message: "Invalid or expired password reset link" });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    // Update password and clear reset token
    await User.updateUserPassword(user.id, passwordHash);
    await User.updateUserResetToken(user.id, null, null);

    console.log("Password reset successful for user ID:", user.id);
    res.json({
      message:
        "Password reset successful. You can now log in with your new password.",
    });
  } catch (error) {
    console.error("Error in reset password:", error);
    res.status(500).json({ message: "Failed to reset password" });
  }
};
