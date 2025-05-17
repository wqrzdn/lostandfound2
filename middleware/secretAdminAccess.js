/**
 * Secret admin access middleware
 * This middleware checks if the email is a secret admin email and grants admin privileges
 */

const User = require('../models/User');

const secretAdminEmail = process.env.SECRET_ADMIN_EMAIL || 'admin@lostandfound.com';

const secretAdminAccess = async (req, res, next) => {
  try {
    // Only check during authentication flow (login)
    if (!req.user && req.body && req.body.email) {
      const email = req.body.email.toLowerCase();
      
      // Check if this is the secret admin email
      if (email === secretAdminEmail) {
        console.log('Secret admin email detected');
        // Create a local variable in res.locals instead of using session
        // This avoids potential issues with session not being available
        res.locals.isSecretAdminAttempt = true;
      }
    }
    next();
  } catch (err) {
    console.error('Secret admin middleware error:', err);
    // Don't break the authentication flow on error
    next();
  }
};

// Function to promote user to admin if they use the secret email
const promoteToAdmin = async (user) => {
  if (!user) return null;
  
  try {
    console.log('Checking if user should be promoted:', user.email);
    // Check if user email matches the secret admin email
    if (user.email.toLowerCase() === secretAdminEmail) {
      console.log(`Checking current role: ${user.role}`);
      if (user.role !== 'admin') {
        console.log(`Promoting user ${user.email} to admin role`);
        user.role = 'admin';
        await user.save();
        console.log('User successfully promoted to admin');
      } else {
        console.log('User is already an admin, no promotion needed');
      }
      return user;
    }
    return user;
  } catch (err) {
    console.error('Error in admin promotion:', err);
    // Return the original user without throwing an error
    // to prevent breaking the authentication flow
    return user;
  }
};

module.exports = { secretAdminAccess, promoteToAdmin };
