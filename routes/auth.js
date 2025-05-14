const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');

// Display login page
router.get('/login', (req, res) => {
  let successMessage = null;
  
  // Check for status parameters
  if (req.query.status === 'loggedout') {
    successMessage = 'You have been successfully logged out';
  }
  
  res.render('auth/login', { 
    success: successMessage,
    error: null
  });
});

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
    const { email, password } = req.body;
    
    console.log('Login attempt for:', email);
    
    // Basic validation
    if (!email || !password) {
      req.flash('error', 'Please provide email and password');
      return res.render('auth/login', { error: 'Please provide email and password' });
    }
    
    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      console.log('Login failed: User not found -', email);
      req.flash('error', 'Invalid credentials');
      return res.render('auth/login', { error: 'Invalid credentials' });
    }
    
    // Check password - Using try/catch for robust error handling
    let isMatch = false;
    try {
      isMatch = await user.matchPassword(password);
    } catch (err) {
      console.error('Password verification error:', err.message);
      req.flash('error', 'Authentication error');
      return res.render('auth/login', { error: 'Authentication error' });
    }
    
    if (!isMatch) {
      console.log('Login failed: Invalid password for', email);
      req.flash('error', 'Invalid credentials');
      return res.render('auth/login', { error: 'Invalid credentials' });
    }
    
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
      return res.redirect('/');
    }
  } catch (err) {
    console.error('Login route error:', err);
    req.flash('error', 'An error occurred during login');
    res.render('auth/login', { error: 'Server error during login' });
  }
});

// Logout route - completely rewritten to eliminate any session or flash-related errors
router.get('/logout', (req, res) => {
  try {
    // 1. Clear the JWT token cookie
    res.clearCookie('token', {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production'
    });
    
    // 2. Clear all cookies to be thorough
    const cookies = req.cookies;
    for (const cookieName in cookies) {
      res.clearCookie(cookieName, { path: '/' });
    }

    // 3. Reset any session data without callback (avoiding async issues)
    if (req.session) {
      req.session = null;
    }

    // 4. Force redirect to login without using flash messages
    // Using a query parameter instead of flash to show success message
    console.log('User logged out successfully');
    return res.redirect('/auth/login?status=loggedout');
  } catch (error) {
    console.error('Logout error:', error);
    // Even if there's an error, still try to redirect the user
    return res.redirect('/auth/login');
  }
});

module.exports = router;