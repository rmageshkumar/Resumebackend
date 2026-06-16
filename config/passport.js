const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const GitHubStrategy = require("passport-github2").Strategy;
const LinkedInStrategy = require("passport-linkedin-oauth2").Strategy;
const { Strategy: JwtStrategy, ExtractJwt } = require("passport-jwt");
const db = require("../config/db");
const bcrypt = require("bcryptjs");
const User = require("../models/userModel");

// 🔹 Local Strategy (Email & Password)
passport.use(
  new LocalStrategy(
    { usernameField: "email" },
    async (email, password, done) => {
      try {
        const user = await User.findUserByEmail(email);
        if (!user) return done(null, false, { message: "User not found" });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch)
          return done(null, false, { message: "Incorrect password" });

        return done(null, user);
      } catch (error) {
        return done(error);
      }
    },
  ),
);

// 🔹 Google Strategy
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: "/api/auth/google/callback",
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          let user = await User.findUserByEmail(profile.emails[0].value);
          if (!user) {
            user = await User.createUser(
              profile.displayName,
              profile.emails[0].value,
              null,
              "google",
            );
          }
          return done(null, user);
        } catch (err) {
          return done(err);
        }
      },
    ),
  );
} else {
  console.warn(
    "Google OAuth not configured — skipping GoogleStrategy registration.",
  );
}

// 🔹 GitHub Strategy
if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  passport.use(
    new GitHubStrategy(
      {
        clientID: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        callbackURL: "/api/auth/github/callback",
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email =
            profile.emails?.[0]?.value || `${profile.username}@github.com`;
          let user = await User.findUserByEmail(email);
          if (!user) {
            user = await User.createUser(
              profile.username,
              email,
              null,
              "github",
            );
          }
          return done(null, user);
        } catch (err) {
          return done(err);
        }
      },
    ),
  );
} else {
  console.warn(
    "GitHub OAuth not configured — skipping GitHubStrategy registration.",
  );
}

// 🔹 LinkedIn Strategy
if (process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET) {
  passport.use(
    new LinkedInStrategy(
      {
        clientID: process.env.LINKEDIN_CLIENT_ID,
        clientSecret: process.env.LINKEDIN_CLIENT_SECRET,
        callbackURL: "/api/auth/linkedin/callback",
        scope: ["r_emailaddress", "r_liteprofile"],
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          let user = await User.findUserByEmail(profile.emails[0].value);
          if (!user) {
            user = await User.createUser(
              profile.displayName,
              profile.emails[0].value,
              null,
              "linkedin",
            );
          }
          return done(null, user);
        } catch (err) {
          return done(err);
        }
      },
    ),
  );
} else {
  console.warn(
    "LinkedIn OAuth not configured — skipping LinkedInStrategy registration.",
  );
}

passport.use(
  new JwtStrategy(
    {
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.JWT_SECRET,
    },
    async (jwtPayload, done) => {
      try {
        console.log("JWT payload:", jwtPayload);
        // Make sure you're using the correct property from the payload
        const user = await User.findUserById(jwtPayload.userId);
        console.log("User lookup result:", user);

        if (!user) {
          return done(null, false);
        }

        return done(null, user);
      } catch (error) {
        console.error("JWT strategy error:", error);
        return done(error, false);
      }
    },
  ),
);

// 🔹 Serialization & Deserialization
passport.serializeUser((user, done) => {
  console.log("Serializing user:", user);
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findUserById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

module.exports = passport;
