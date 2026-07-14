const User = require("../models/userModel");
const pool = require("../config/db");

/**
 * Check if a user is an admin (bypasses all subscription checks).
 */
const isAdmin = async (userId) => {
  try {
    const [[user]] = await pool.query(
      "SELECT is_admin FROM users WHERE id = ?",
      [userId],
    );
    return user?.is_admin === 1;
  } catch {
    return false;
  }
};

/**
 * Middleware to check if user has at least the required plan level.
 * Plan hierarchy: free < premium. Admin users bypass all checks.
 */
const requirePlan = (requiredPlan) => {
  return async (req, res, next) => {
    try {
      const userId = req.user.userId || req.user.id;

      // Admin bypass — full access
      if (await isAdmin(userId)) {
        const user = await User.findUserById(userId);
        req.fullUser = user;
        return next();
      }

      // Get fresh user data from DB (don't rely on JWT payload)
      const user = await User.findUserById(userId);

      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      const currentPlan = user.subscription_plan || "free";
      const status = user.subscription_status || "inactive";

      const planHierarchy = { free: 0, premium: 1 };
      const requiredLevel = planHierarchy[requiredPlan] ?? 0;
      const currentLevel = planHierarchy[currentPlan] ?? 0;

      if (currentLevel < requiredLevel) {
        return res.status(403).json({
          message: `This feature requires a ${requiredPlan} subscription. Please upgrade your plan.`,
          requiredPlan,
          currentPlan,
          code: "UPGRADE_REQUIRED",
        });
      }

      // For premium plans, check status is active (or trialing)
      if (
        currentPlan === "premium" &&
        !["active", "trialing"].includes(status)
      ) {
        return res.status(403).json({
          message:
            "Your subscription is not active. Please update your payment method.",
          requiredPlan,
          currentPlan,
          status,
          code: "SUBSCRIPTION_INACTIVE",
        });
      }

      // Attach full user to request for downstream use
      req.fullUser = user;
      next();
    } catch (error) {
      console.error("Subscription middleware error:", error);
      res.status(500).json({ message: "Error checking subscription" });
    }
  };
};

/**
 * Middleware to check resume creation quota for free plan users.
 * Admin users bypass quota limits.
 */
const checkResumeQuota = async (req, res, next) => {
  try {
    const userId = req.user.userId || req.user.id;

    // Admin bypass — unlimited resumes
    if (await isAdmin(userId)) {
      const user = await User.findUserById(userId);
      req.fullUser = user;
      return next();
    }

    const user = await User.findUserById(userId);

    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    const currentPlan = user.subscription_plan || "free";

    // Premium users have unlimited resumes
    if (currentPlan === "premium") {
      req.fullUser = user;
      return next();
    }

    // Free plan: limit to 1 resume
    const [rows] = await pool.query(
      "SELECT COUNT(*) AS count FROM user_resumes WHERE user_id = ?",
      [user.id],
    );
    const resumeCount = rows[0]?.count || 0;

    if (resumeCount >= 1) {
      return res.status(403).json({
        message:
          "Free plan allows only 1 resume. Upgrade to Premium for unlimited resumes.",
        code: "RESUME_QUOTA_EXCEEDED",
        quota: { limit: 1, used: resumeCount, plan: "free" },
      });
    }

    req.fullUser = user;
    next();
  } catch (error) {
    console.error("Resume quota middleware error:", error);
    res.status(500).json({ message: "Error checking resume quota" });
  }
};

module.exports = { requirePlan, checkResumeQuota };
