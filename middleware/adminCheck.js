/**
 * Middleware to check if a user is an admin
 * This will be used in routes to provide admin privileges
 */

module.exports = function(req, res, next) {
  // If no user is logged in, they're definitely not an admin
  if (!req.user) {
    return res.status(401).render('error', {
      message: 'Unauthorized - Please log in',
      error: { status: 401 }
    });
  }

  // Check if the user has admin role
  if (req.user.role !== 'admin') {
    return res.status(403).render('error', {
      message: 'Forbidden - Admin access required',
      error: { status: 403 }
    });
  }

  // If we reach here, the user is an admin
  next();
};
