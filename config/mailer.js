const nodemailer = require("nodemailer");

console.log("email user", process.env.EMAIL_USER);
console.log("email pass", process.env.EMAIL_PASS);
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

exports.sendActivationEmail = (email, token) => {
  const activationLink = `${process.env.FRONTEND_URL}/activate/${token}`;

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: "Activate Your Account",
    html: `<p>Click <a href="${activationLink}">here</a> to activate your account.</p>`,
  };

  return transporter.sendMail(mailOptions);
};

exports.sendPasswordResetEmail = (email, token) => {
  const resetLink = `${process.env.FRONTEND_URL}/reset-password/${token}`;

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: "Reset Your Password",
    html: `
      <p>You requested a password reset. Click <a href="${resetLink}">here</a> to reset your password.</p>
      <p>This link will expire in 1 hour.</p>
    `,
  };

  return transporter.sendMail(mailOptions);
};
