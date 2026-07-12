const pool = require("../config/db");

/**
 * Fraud detection middleware.
 * Monitors for suspicious patterns: rapid requests, duplicate accounts,
 * and known abuse patterns.
 */

const requestCounts = new Map();
const SUSPICIOUS_THRESHOLD = 50; // requests per window
const WINDOW_MS = 60 * 1000; // 1 minute window

/**
 * Middleware: detects rapid-fire requests from same IP.
 * Blocks IPs that exceed the threshold.
 */
const detectRapidRequests = (req, res, next) => {
  const ip = req.ip || req.connection?.remoteAddress || "unknown";
  const now = Date.now();
  const windowStart = now - WINDOW_MS;

  if (!requestCounts.has(ip)) {
    requestCounts.set(ip, []);
  }

  const timestamps = requestCounts.get(ip).filter((t) => t > windowStart);
  timestamps.push(now);
  requestCounts.set(ip, timestamps);

  if (timestamps.length > SUSPICIOUS_THRESHOLD) {
    console.warn(`🚨 Fraud detection: Rate limit exceeded for IP ${ip}`);
    return res.status(429).json({
      message: "Too many requests. Please slow down.",
      code: "RATE_LIMITED",
    });
  }

  next();
};

/**
 * Middleware: detects if email domain is from a known disposable email provider.
 */
const DISPOSABLE_DOMAINS = [
  "mailinator.com",
  "guerrillamail.com",
  "tempmail.com",
  "throwaway.com",
  "yopmail.com",
  "sharklasers.com",
  "trashmail.com",
  "10minutemail.com",
];

const detectDisposableEmail = (req, res, next) => {
  const email = req.body?.email || "";
  const domain = email.split("@")[1]?.toLowerCase();

  if (domain && DISPOSABLE_DOMAINS.includes(domain)) {
    console.warn(`🚨 Fraud detection: Disposable email rejected: ${email}`);
    return res.status(400).json({
      message: "Please use a permanent email address.",
      code: "DISPOSABLE_EMAIL",
    });
  }

  next();
};

/**
 * Middleware: logs suspicious activity to audit_logs for manual review.
 */
const logSuspiciousActivity = async (req, action) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    await pool.execute(
      "INSERT INTO audit_logs (user_id, action, resource, details, ip_address, created_at) VALUES (?, ?, ?, ?, ?, NOW())",
      [
        userId || 0,
        action,
        "security",
        JSON.stringify({
          path: req.path,
          method: req.method,
          userAgent: req.headers["user-agent"],
        }),
        req.ip,
      ],
    );
  } catch (err) {
    // Don't block the request for audit logging failures
  }
};

module.exports = {
  detectRapidRequests,
  detectDisposableEmail,
  logSuspiciousActivity,
};
