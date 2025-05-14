const jwt = require('jsonwebtoken');
const User = require('../models/User');

module.exports = async (req, res, next) => {
  try {
    // If user is already authenticated via Passport (Google OAuth)
    if (req.isAuthenticated && req.isAuthenticated() && req.user) {
      // User is already authenticated via Passport, no need to verify JWT
      res.locals.user = req.user;
      console.log(`User authenticated via Passport: ${req.user.email} (${req.user.role})`);
      return next();
    }
    
    // Get token from cookies for JWT authentication
    const token = req.cookies.token;
    
    // Set default - no authenticated user
    if (!req.user) {
      req.user = null;
      res.locals.user = null;
    }
    
    // Skip token verification if no token exists
    if (!token) {
      return next();
    }
    
    // Verify the token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get user from database
    if (decoded && decoded.id) {
      const user = await User.findById(decoded.id).select('-password');
      
      if (user) {
        // Set user in both req and res.locals for consistent template access
        req.user = user;
        res.locals.user = user;
        
        console.log(`User authenticated via JWT: ${user.email} (${user.role})`);
      }
    }
    
    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    // Don't reset req.user if it's already set by Passport
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      req.user = null;
      res.locals.user = null;
    }
    next();
  }
};