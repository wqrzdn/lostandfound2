const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');

// Serialize user for the session
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// Deserialize user from the session
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

// Configure Google OAuth Strategy
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "/auth/google/callback",
    proxy: true
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      // Check if user already exists
      let user = await User.findOne({ googleId: profile.id });
      
      if (user) {
        // User exists, return the user
        return done(null, user);
      }
      
      // Check if user exists with same email
      user = await User.findOne({ email: profile.emails[0].value });
      
      if (user) {
        // User exists with email, update with Google ID
        user.googleId = profile.id;
        await user.save();
        return done(null, user);
      }
      
      // Create new user
      const newUser = new User({
        name: profile.displayName,
        email: profile.emails[0].value,
        googleId: profile.id,
        profileImage: profile.photos[0].value
      });
      
      await newUser.save();
      return done(null, newUser);
    } catch (err) {
      console.error('Google authentication error:', err);
      return done(err, null);
    }
  }
));

module.exports = passport;
