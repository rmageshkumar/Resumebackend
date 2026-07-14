const pool = require("../config/db");

/**
 * Admin-only controller for user management and analytics.
 * All routes require admin authentication middleware.
 */

// ── Dashboard Overview Stats ──
exports.getDashboardStats = async (req, res) => {
  try {
    const [[userCount]] = await pool.query(
      "SELECT COUNT(*) AS total FROM users",
    );
    const [[resumeCount]] = await pool.query(
      "SELECT COUNT(*) AS total FROM user_resumes",
    );

    // These columns may not exist in older databases
    let activeSubscriptions = { total: 0 };
    let trialUsers = { total: 0 };
    try {
      [activeSubscriptions] = await pool.query(
        "SELECT COUNT(*) AS total FROM users WHERE subscription_status = 'active'",
      );
    } catch (_) {}
    try {
      [trialUsers] = await pool.query(
        "SELECT COUNT(*) AS total FROM users WHERE subscription_plan = 'free'",
      );
    } catch (_) {}

    let purchases = { total: 0 };
    try {
      [purchases] = await pool.query(
        "SELECT COUNT(*) AS total FROM template_purchases",
      );
    } catch (_) {}

    res.json({
      users: userCount.total,
      resumes: resumeCount.total,
      purchases: purchases.total,
      activeSubscriptions: activeSubscriptions.total,
      trialUsers: trialUsers.total,
    });
  } catch (error) {
    console.error("Admin dashboard stats error:", error);
    res.status(500).json({ message: "Failed to fetch stats" });
  }
};

// ── List All Users ──
exports.listUsers = async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = "SELECT id, name, email, provider, created_at FROM users";
    let countQuery = "SELECT COUNT(*) AS total FROM users";
    const params = [];
    const countParams = [];

    if (search) {
      const where = " WHERE name LIKE ? OR email LIKE ?";
      query += where;
      countQuery += where;
      const searchParam = `%${search}%`;
      params.push(searchParam, searchParam);
      countParams.push(searchParam, searchParam);
    }

    query += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
    params.push(parseInt(limit), offset);

    const [users] = await pool.query(query, params);
    const [[{ total }]] = await pool.query(countQuery, countParams);

    res.json({
      users,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
    });
  } catch (error) {
    console.error("Admin list users error:", error);
    res.status(500).json({
      message: "Failed to fetch users",
      error: error.message,
      sql: error.sql,
    });
  }
};

// ── Revenue Analytics ──
exports.getRevenueAnalytics = async (req, res) => {
  try {
    const { period = "monthly" } = req.query;

    let dateFormat;
    if (period === "daily") dateFormat = "DATE(purchased_at)";
    else if (period === "yearly")
      dateFormat = "DATE_FORMAT(purchased_at, '%Y')";
    else dateFormat = "DATE_FORMAT(purchased_at, '%Y-%m')";

    const [revenueByPeriod] = await pool.query(
      `SELECT ${dateFormat} AS period, COUNT(*) AS purchases,
              COALESCE(SUM(CAST(REPLACE(price, '$', '') AS DECIMAL(10,2))), 0) AS revenue
       FROM template_purchases
       GROUP BY period ORDER BY period DESC LIMIT 12`,
    );

    const [planDistribution] = await pool.query(
      "SELECT subscription_plan, COUNT(*) AS count FROM users GROUP BY subscription_plan",
    );

    res.json({ revenueByPeriod, planDistribution });
  } catch (error) {
    console.error("Admin revenue analytics error:", error);
    res.status(500).json({ message: "Failed to fetch revenue analytics" });
  }
};

// ── Recent Activity ──
exports.getRecentActivity = async (req, res) => {
  try {
    const [activities] = await pool.query(
      "SELECT action, resource, resource_id, created_at FROM audit_logs ORDER BY created_at DESC LIMIT 50",
    );
    res.json({ activities });
  } catch (error) {
    console.error("Admin activity error:", error);
    res.status(500).json({ message: "Failed to fetch activity" });
  }
};

// ── Grant Admin Privileges ──
exports.grantAdmin = async (req, res) => {
  try {
    const { userId, email } = req.body;
    const identifier = userId || "";

    if (!identifier && !email) {
      return res.status(400).json({ message: "Provide userId or email" });
    }

    if (email) {
      await pool.execute("UPDATE users SET is_admin = 1 WHERE email = ?", [
        email,
      ]);
      const [[user]] = await pool.query(
        "SELECT id, email, name FROM users WHERE email = ?",
        [email],
      );
      if (!user) return res.status(404).json({ message: "User not found" });
      console.log(`Admin granted to ${email}`);
      return res.json({ success: true, user });
    }

    await pool.execute("UPDATE users SET is_admin = 1 WHERE id = ?", [
      identifier,
    ]);
    const [[user]] = await pool.query(
      "SELECT id, email, name FROM users WHERE id = ?",
      [identifier],
    );
    if (!user) return res.status(404).json({ message: "User not found" });
    console.log(`Admin granted to user ID ${identifier}`);
    res.json({ success: true, user });
  } catch (error) {
    console.error("Grant admin error:", error);
    res.status(500).json({ message: "Failed to grant admin" });
  }
};
