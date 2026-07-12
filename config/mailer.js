const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 10000,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const EMAIL_ENABLED = !!(process.env.EMAIL_USER && process.env.EMAIL_PASS);

async function sendMail({ to, subject, html }) {
  if (!EMAIL_ENABLED) {
    console.warn("Email skipped (not configured):", subject, "->", to);
    return { skipped: true };
  }
  try {
    await transporter.sendMail({
      from: `"ProSummo" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
    });
    console.log("Email sent:", subject, "->", to);
    return { success: true };
  } catch (err) {
    console.error("Email failed:", subject, "->", to, err.message);
    return { success: false, error: err.message };
  }
}

exports.sendActivationEmail = (email, token) => {
  const link = `${process.env.FRONTEND_URL}/activate/${token}`;
  return sendMail({
    to: email,
    subject: "Welcome to ProSummo — Activate Your Account",
    html: `
      <div style="max-width:480px;margin:0 auto;font-family:Inter,sans-serif;">
        <h1 style="color:#1e40af;">Welcome to ProSummo!</h1>
        <p>You're one step away from building your professional resume.</p>
        <a href="${link}" style="display:inline-block;padding:12px 24px;background:#1e40af;color:#fff;border-radius:8px;text-decoration:none;margin:16px 0;">Activate Account</a>
        <p style="color:#6b7280;font-size:14px;">If you didn't create an account, ignore this email.</p>
      </div>`,
  });
};

exports.sendPasswordResetEmail = (email, token) => {
  const link = `${process.env.FRONTEND_URL}/reset-password/${token}`;
  return sendMail({
    to: email,
    subject: "Reset Your ProSummo Password",
    html: `
      <div style="max-width:480px;margin:0 auto;font-family:Inter,sans-serif;">
        <h1 style="color:#1e40af;">Reset Your Password</h1>
        <p>Click below to reset your password. Link expires in 1 hour.</p>
        <a href="${link}" style="display:inline-block;padding:12px 24px;background:#1e40af;color:#fff;border-radius:8px;text-decoration:none;margin:16px 0;">Reset Password</a>
        <p style="color:#6b7280;font-size:14px;">If you didn't request this, ignore this email.</p>
      </div>`,
  });
};

exports.sendWelcomeEmail = (email, name) => {
  return sendMail({
    to: email,
    subject: "Welcome to ProSummo! Start Building Your Resume",
    html: `
      <div style="max-width:480px;margin:0 auto;font-family:Inter,sans-serif;">
        <h1 style="color:#1e40af;">Hi ${name || "there"}!</h1>
        <p>Welcome! You're ready to build professional, ATS-friendly resumes.</p>
        <a href="${process.env.FRONTEND_URL}/dashboard/create-resume" style="display:inline-block;padding:12px 24px;background:#1e40af;color:#fff;border-radius:8px;text-decoration:none;margin:16px 0;">Create Your First Resume</a>
      </div>`,
  });
};

exports.sendAbandonedReminderEmail = (email, name) => {
  return sendMail({
    to: email,
    subject: "Your free resume is waiting!",
    html: `
      <div style="max-width:480px;margin:0 auto;font-family:Inter,sans-serif;">
        <h1 style="color:#1e40af;">Don't forget your resume, ${name || "friend"}!</h1>
        <p>You signed up but haven't created a resume yet. It only takes 5 minutes.</p>
        <a href="${process.env.FRONTEND_URL}/dashboard/create-resume" style="display:inline-block;padding:12px 24px;background:#1e40af;color:#fff;border-radius:8px;text-decoration:none;margin:16px 0;">Build My Resume</a>
      </div>`,
  });
};

exports.sendRenewalReminderEmail = (email, plan) => {
  return sendMail({
    to: email,
    subject: "Your ProSummo Premium subscription renews soon",
    html: `
      <div style="max-width:480px;margin:0 auto;font-family:Inter,sans-serif;">
        <h1 style="color:#1e40af;">Premium Renewal Notice</h1>
        <p>Your ${plan} plan will renew in 3 days. No action needed.</p>
        <p style="color:#6b7280;font-size:14px;">Need to update payment? <a href="${process.env.FRONTEND_URL}/pricing" style="color:#1e40af;">Manage Subscription</a></p>
      </div>`,
  });
};
