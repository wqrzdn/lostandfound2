/**
 * Middleware to redirect users to appropriate pages based on their roles
 * Admin users go to admin dashboard, regular users go to user pages
 */
module.exports = (req, res, next) => {
  // If no user is logged in, proceed normally
  if (!req.user) {
    return next();
  }
  
  // If user is an admin, redirect to admin dashboard
  if (req.user.role === 'admin') {
    // Prevent redirect loops
    if (req.path.startsWith('/admin')) {
      return next();
    }
    return res.redirect('/admin/dashboard');
  }
  
  // If user is NOT an admin but tries to access admin pages, redirect to items
  if (req.user.role !== 'admin' && req.path.startsWith('/admin')) {
    return res.redirect('/items');
  }
  
  // For all other cases, proceed normally
  next();
};
