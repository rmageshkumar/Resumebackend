const User = require("../models/userModel");
const pool = require("../config/db");

/**
 * Middleware to check if user has at least the required plan level.
 * Plan hierarchy: free < premium
 */
const requirePlan = (requiredPlan) => {
  return async (req, res, next) => {
    try {
      // Get fresh user data from DB (don't rely on JWT payload)
      const user = await User.findUserById(req.user.userId || req.user.id);

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
 */
const checkResumeQuota = async (req, res, next) => {
  try {
    const user = await User.findUserById(req.user.userId || req.user.id);

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
