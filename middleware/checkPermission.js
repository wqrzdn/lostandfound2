/**
 * Check if user has permission to modify an item
 * Admins can modify any item
 * Regular users can only modify their own items
 */
module.exports = (req, res, item) => {
  // If no user or no item, deny permission
  if (!req.user || !item) {
    return false;
  }
  
  // If user is admin, allow access to any item
  if (req.user.role === 'admin') {
    console.log('Admin permission granted for:', req.user.email);
    return true;
  }
  
  // If item has no user associated, deny permission
  if (!item.user) {
    return false;
  }
  
  // Check if user owns the item
  const isOwner = item.user.toString() === req.user._id.toString();
  
  if (isOwner) {
    console.log('Owner permission granted for:', req.user.email);
    return true;
  } else {
    console.log('Permission denied - not owner or admin');
    return false;
  }
};
