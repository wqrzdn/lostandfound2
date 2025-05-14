/**
 * Middleware to protect routes that require admin access
 * Redirects to appropriate location based on user role
 */
module.exports = (req, res, next) => {
  // First check if user is authenticated at all
  if (!req.user) {
    // If no user is logged in, redirect to login
    if (req.flash) {
      req.flash('error', 'Please log in to access this page');
    }
    return res.redirect('/auth/login');
  }
  
  // Check if user has admin role
  if (req.user.role !== 'admin') {
    // If user is logged in but not admin, redirect to items page
    if (req.flash) {
      req.flash('error', 'You do not have permission to access the admin area');
    }
    return res.redirect('/items');
  }
  
  // If user is an admin, proceed to the next middleware
  next();
};
