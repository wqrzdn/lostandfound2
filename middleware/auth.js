const jwt = require('jsonwebtoken');
const User = require('../models/User');

module.exports = async (req, res, next) => {
  try {
    // Get token from cookies
    const token = req.cookies.token;
    
    // Set default - no authenticated user
    req.user = null;
    res.locals.user = null;
    
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
        
        console.log(`User authenticated: ${user.email} (${user.role})`);
      }
    }
    
    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    req.user = null;
    res.locals.user = null;
    next();
  }
};