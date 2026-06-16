const pool = require("../config/db");

exports.findUserByEmail = async (email) => {
  console.log("Finding user by email:", email);
  try {
    // Use the promise-based API directly
    const [rows] = await pool.execute("SELECT * FROM users WHERE email = ?", [
      email,
    ]);
    console.log(
      `User lookup result: ${rows.length > 0 ? "Found" : "Not found"}`,
    );
    return rows[0]; // Return first user found or undefined
  } catch (error) {
    console.error("Database error when finding user by email:", error);
    throw error;
  }
};

// Add debugging to findUserById
exports.findUserById = async (id) => {
  console.log("Finding user by ID:", id);
  try {
    const [rows] = await pool.execute("SELECT * FROM users WHERE id = ?", [id]);
    console.log(
      `User ID lookup result: ${rows ? (rows.length > 0 ? "Found" : "Not found") : "No results"}`,
    );
    if (rows && rows.length > 0) {
      console.log("Found user:", rows[0]);
    }
    return rows[0];
  } catch (error) {
    console.error("Database error when finding user by ID:", error);
    throw error;
  }
};

exports.findUserByResetToken = async (token) => {
  console.log("Finding user by reset token:", token);
  try {
    const [rows] = await pool.execute(
      "SELECT * FROM users WHERE reset_password_token = ? AND reset_password_expires > NOW()",
      [token],
    );
    return rows[0];
  } catch (error) {
    console.error("Database error when finding user by reset token:", error);
    throw error;
  }
};

exports.updateUserResetToken = async (id, token, expires) => {
  console.log("Updating reset token for user ID:", id);
  try {
    await pool.execute(
      "UPDATE users SET reset_password_token = ?, reset_password_expires = ? WHERE id = ?",
      [token, expires, id],
    );
  } catch (error) {
    console.error("Database error when updating reset token:", error);
    throw error;
  }
};

exports.createUser = async (name, email, password, provider = "local") => {
  console.log("Creating new user:", email);
  try {
    const [result] = await pool.execute(
      "INSERT INTO users (name, email, password, provider) VALUES (?, ?, ?, ?)",
      [name, email, password, provider],
    );
    console.log("User created successfully with ID:", result.insertId);
    return result.insertId;
  } catch (error) {
    console.error("Database error when creating user:", error);
    throw error;
  }
};

exports.updateUserProfile = async (id, profileData) => {
  console.log("Updating profile for user ID:", id);
  console.log("Profile data to update:", Object.keys(profileData));

  // Build the query dynamically based on provided fields
  const fields = [];
  const values = [];

  if (profileData.name) {
    fields.push("name = ?");
    values.push(profileData.name);
  }

  if (profileData.bio !== undefined) {
    fields.push("bio = ?");
    values.push(profileData.bio);
  }

  if (profileData.location !== undefined) {
    fields.push("location = ?");
    values.push(profileData.location);
  }

  if (profileData.phone !== undefined) {
    fields.push("phone = ?");
    values.push(profileData.phone);
  }

  if (profileData.website !== undefined) {
    fields.push("website = ?");
    values.push(profileData.website);
  }

  if (profileData.profileImage !== undefined) {
    fields.push("profileImage = ?");
    values.push(profileData.profileImage);
  }

  // Add the user ID to values array
  values.push(id);

  // If no fields to update, resolve early
  if (fields.length === 0) {
    return;
  }

  const query = `UPDATE users SET ${fields.join(", ")} WHERE id = ?`;

  console.log("Running query:", query);
  const [result] = await pool.execute(query, values);
  console.log("User profile updated successfully");
  return result;
};

exports.updateUserPassword = async (id, passwordHash) => {
  console.log("Updating password for user ID:", id);
  await pool.execute("UPDATE users SET password = ? WHERE id = ?", [
    passwordHash,
    id,
  ]);
  console.log("User password updated successfully");
};

exports.updateStripeCustomerId = async (id, customerId) => {
  await pool.execute("UPDATE users SET stripe_customer_id = ? WHERE id = ?", [
    customerId,
    id,
  ]);
};

exports.updateUserSubscription = async (id, updates) => {
  const fields = [];
  const values = [];

  if (updates.subscription_plan !== undefined) {
    fields.push("subscription_plan = ?");
    values.push(updates.subscription_plan);
  }

  if (updates.subscription_status !== undefined) {
    fields.push("subscription_status = ?");
    values.push(updates.subscription_status);
  }

  if (updates.stripe_customer_id !== undefined) {
    fields.push("stripe_customer_id = ?");
    values.push(updates.stripe_customer_id);
  }

  if (updates.stripe_subscription_id !== undefined) {
    fields.push("stripe_subscription_id = ?");
    values.push(updates.stripe_subscription_id);
  }

  if (fields.length === 0) {
    return;
  }

  values.push(id);
  const query = `UPDATE users SET ${fields.join(", ")} WHERE id = ?`;
  await pool.execute(query, values);
};

exports.updateSubscriptionStatusByStripeId = async (
  stripeSubscriptionId,
  status,
) => {
  await pool.execute(
    "UPDATE users SET subscription_status = ? WHERE stripe_subscription_id = ?",
    [status, stripeSubscriptionId],
  );
};

exports.findTemplatePurchase = async (userId, templateId) => {
  const [rows] = await pool.execute(
    "SELECT * FROM template_purchases WHERE user_id = ? AND template_id = ?",
    [userId, templateId],
  );
  return rows[0];
};

exports.addTemplatePurchase = async (userId, templateId, price) => {
  await pool.execute(
    "INSERT INTO template_purchases (user_id, template_id, price) VALUES (?, ?, ?)",
    [userId, templateId, price],
  );
};

exports.getUserTemplatePurchases = async (userId) => {
  const [rows] = await pool.execute(
    "SELECT template_id, price, purchased_at FROM template_purchases WHERE user_id = ?",
    [userId],
  );
  return rows;
};
