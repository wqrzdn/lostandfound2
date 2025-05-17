const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const passport = require('passport');

// Display login page
router.get('/login', (req, res) => {
  let successMessage = null;
  
  // Check for status parameters
  if (req.query.status === 'loggedout') {
    successMessage = 'You have been successfully logged out';
  }
  
  // Get redirect URL from query parameter or default to dashboard
  const redirectTo = req.query.redirect || '/dashboard';
  
  res.render('auth/login', { 
    success: successMessage,
    error: null,
    redirectTo
  });
});

// Google OAuth Login Route
router.get('/google', passport.authenticate('google', { 
  scope: ['profile', 'email'] 
}));

// Google OAuth Callback Route
router.get('/google/callback', 
  passport.authenticate('google', { 
    failureRedirect: '/auth/login',
    failureFlash: true
  }), 
  (req, res) => {
    try {
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
        req.user.updateLoginTimestamp();
      }
      
      // Success message and redirect based on role
      console.log('Google login successful for:', req.user.email, 'Role:', req.user.role);
      
      // Redirect to the appropriate page based on user role
      if (req.user.role === 'admin') {
        req.flash('success', 'Welcome to Admin Dashboard');
        return res.redirect('/admin/dashboard');
      } else {
        // Check if there was a return URL stored in the session
        const returnTo = req.session.returnTo || '/';
        delete req.session.returnTo;
        
        req.flash('success', 'Login successful! Welcome back.');
        return res.redirect(returnTo);
      }
    } catch (err) {
      console.error('Google callback route error:', err);
      req.flash('error', 'An error occurred during Google login');
      res.redirect('/auth/login');
    }
  }
);

// Display register page
router.get('/register', (req, res) => {
  res.render('auth/register');
});

// Register route
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;
    
    console.log('Registration attempt:', { name, email, phone }); // Debug log
    
    // Check if user exists
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).render('auth/register', { 
        error: 'User already exists' 
      });
    }
    
    // Create new user
    user = new User({
      name,
      email,
      password,
      phone: phone || ''
    });
    
    await user.save();
    
    // Show success message on login page
    req.flash('success', 'Registration successful! Please log in with your new account.');
    
    // Redirect to login
    res.redirect('/auth/login');
  } catch (err) {
    console.error(err);
    res.status(500).render('error', { 
      message: 'Server error', 
      error: err 
    });
  }
});

// Login route
router.post('/login', async (req, res) => {
  try {
    const { email, password, redirectTo } = req.body;
    
    console.log('Login attempt for:', email);
    
    // Basic validation
    if (!email || !password) {
      req.flash('error', 'Please provide email and password');
      return res.render('auth/login', { error: 'Please provide email and password', redirectTo });
    }
    
    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      console.log('Login failed: User not found -', email);
      req.flash('error', 'Invalid credentials');
      return res.render('auth/login', { error: 'Invalid credentials', redirectTo });
    }
    
    // Check password - Using try/catch for robust error handling
    let isMatch = false;
    try {
      isMatch = await user.matchPassword(password);
    } catch (err) {
      console.error('Password verification error:', err.message);
      req.flash('error', 'Authentication error');
      return res.render('auth/login', { error: 'Authentication error', redirectTo });
    }
    
    if (!isMatch) {
      console.log('Login failed: Invalid password for', email);
      req.flash('error', 'Invalid credentials');
      return res.render('auth/login', { error: 'Invalid credentials', redirectTo });
    }
    
    // Simple log of successful login
    console.log('User authenticated successfully:', user.email);
    
    // Authentication successful - create token
    const token = jwt.sign(
      { id: user._id },
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
    if (typeof user.updateLoginTimestamp === 'function') {
      await user.updateLoginTimestamp();
    }
    
    // Success message and redirect based on role
    console.log('Login successful for:', user.email, 'Role:', user.role);
    
    if (user.role === 'admin') {
      req.flash('success', 'Welcome to Admin Dashboard');
      return res.redirect('/admin/dashboard');
    } else {
      req.flash('success', 'Login successful! Welcome back.');
      // Redirect to the specified URL or dashboard
      return res.redirect(redirectTo || '/dashboard');
    }
  } catch (err) {
    console.error('Login route error:', err);
    console.error('Error details:', err.stack);
    // Provide more specific error messages based on the type of error
    if (err.name === 'ValidationError') {
      req.flash('error', 'Invalid data provided: ' + err.message);
      return res.render('auth/login', { error: 'Invalid data provided', redirectTo });
    } else if (err.name === 'MongoError' || err.name === 'MongoServerError') {
      req.flash('error', 'Database connection issue. Please try again later.');
      return res.render('auth/login', { error: 'Database connection issue', redirectTo });
    } else {
      // For any other errors, log detailed info but show a generic message to user
      req.flash('error', 'An error occurred during login');
      return res.render('auth/login', { error: 'Authentication error: ' + (process.env.NODE_ENV === 'development' ? err.message : 'Please try again'), redirectTo });
    }
  }
});

// Logout route - handles both JWT and Passport authentication
router.get('/logout', (req, res) => {
  try {
    // Get user info for logging before logout
    const userEmail = req.user ? req.user.email : 'Unknown user';
    console.log(`Logging out user: ${userEmail}`);
    
    // 1. Clear the JWT token cookie
    res.clearCookie('token', {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production'
    });
    
    // 2. Clear session if it exists, but don't try to regenerate it
    if (req.session) {
      console.log('Clearing session...');
      req.session = null;
    }

    // 3. Handle Passport logout with a safe approach
    if (req.logout && typeof req.logout === 'function') {
      try {
        // For Passport v0.6.0 and newer that requires a callback
        req.logout(function() {
          console.log('Passport logout completed');
        });
      } catch (logoutErr) {
        // For older Passport versions or if callback approach fails
        try {
          req.logout();
          console.log('Legacy passport logout completed');
        } catch (legacyErr) {
          console.log('Could not perform passport logout:', legacyErr.message);
        }
      }
    }

    // 4. Log and redirect - don't wait for session operations
    console.log(`User logged out successfully: ${userEmail}`);
    return res.redirect('/auth/login?status=loggedout');
  } catch (error) {
    console.error('Logout error:', error);
    // Even if there's an error, still try to redirect the user
    return res.redirect('/auth/login');
  }
});

module.exports = router;