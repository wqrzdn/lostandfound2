/**
 * Middleware to handle Google authentication integration with existing JWT auth
 * This ensures that users authenticated via Google can still use the app's JWT-based system
 */
const jwt = require('jsonwebtoken');
const User = require('../models/User');

module.exports = async (req, res, next) => {
  try {
    // If user is already authenticated via Passport (Google OAuth)
    if (req.isAuthenticated() && req.user && !req.cookies.token) {
      console.log('User authenticated via Google, creating JWT token');
      
      // Create JWT token for the authenticated user
      const token = jwt.sign(
        { id: req.user._id },
        process.env.JWT_SECRET || 'fallback_secret_key',
        { expiresIn: '24h' }
      );
      
      // Set cookie with token
      res.cookie('token', token, {
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        path: '/' // Ensure cookie is available across the site
      });
      
      // Update last login timestamp if the method exists
      if (typeof req.user.updateLoginTimestamp === 'function') {
        await req.user.updateLoginTimestamp();
      }
    }
    
    next();
  } catch (err) {
    console.error('Google auth handler middleware error:', err);
    next();
  }
};
