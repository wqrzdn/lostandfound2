/**
 * Middleware to protect routes that require authentication
 * Redirects to the login page if a user is not authenticated
 */
module.exports = (req, res, next) => {
  // Check if user is authenticated (exists and has an id)
  if (!req.user || !req.user._id) {
    console.log('Access denied: No authenticated user');
    
    // Store the original URL they were trying to access for redirect after login
    if (req.session) {
      req.session.returnTo = req.originalUrl;
    }
    
    // Add a flash message about required login
    if (req.flash) {
      req.flash('error', 'Login required to access this page');
    }
    
    // Redirect to login page
    return res.redirect('/auth/login');
  }
  
  // User is authenticated, proceed to next middleware
  console.log(`Authorized access: ${req.user.email} accessing ${req.originalUrl}`);
  next();
};
