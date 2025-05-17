/**
 * MongoDB Atlas Admin Dashboard Routes
 */

const express = require('express');
const router = express.Router();
const { checkDatabaseHealth } = require('../utils/database');
const Item = require('../models/Item');
const User = require('../models/User');

// Middleware to check admin authorization
const isAdmin = async (req, res, next) => {
  try {
    console.log('MongoDB Atlas Admin auth check - User:', req.user ? `${req.user.email} (${req.user.role})` : 'Not logged in');
    
    // Check if user is logged in
    if (!req.user) {
      console.log('MongoDB Atlas Admin access denied: User not logged in');
      return res.status(401).render('error', {
        message: 'Authentication Required',
        error: { 
          status: 401, 
          stack: 'You must be logged in to access the MongoDB Atlas admin dashboard.'
        }
      });
    }
    
    // Check if user is an admin
    if (req.user.role !== 'admin') {
      console.log('MongoDB Atlas Admin access denied: User not an admin');
      return res.status(403).render('error', {
        message: 'Access Denied',
        error: { 
          status: 403, 
          stack: 'You do not have administrator privileges to access the MongoDB Atlas dashboard.' 
        }
      });
    }
    
    console.log('MongoDB Atlas Admin access granted to:', req.user.email);
    next();
  } catch (err) {
    console.error('MongoDB Atlas Admin auth error:', err);
    res.status(500).render('error', {
      message: 'Server Error',
      error: err
    });
  }
};

// MongoDB Atlas Admin Dashboard
router.get('/dashboard', isAdmin, async (req, res) => {
  try {
    console.log('MongoDB Atlas Admin dashboard accessed by:', req.user.email);
    
    // Get database health information
    const dbHealth = await checkDatabaseHealth();
    
    // Get item statistics
    const itemStats = {};
    try {
      itemStats.total = await Item.countDocuments();
      itemStats.lost = await Item.countDocuments({ type: 'lost' });
      itemStats.found = await Item.countDocuments({ type: 'found' });
      itemStats.active = await Item.countDocuments({ status: 'active' });
      itemStats.resolved = await Item.countDocuments({ status: 'resolved' });
      itemStats.expired = await Item.countDocuments({ status: 'expired' });
    } catch (itemErr) {
      console.error('Error fetching item stats:', itemErr);
      itemStats.error = itemErr.message;
    }
    
    // Get user statistics
    const userStats = {};
    try {
      userStats.total = await User.countDocuments();
      userStats.admins = await User.countDocuments({ role: 'admin' });
      userStats.active = await User.countDocuments({ isActive: true });
      userStats.inactive = await User.countDocuments({ isActive: false });
    } catch (userErr) {
      console.error('Error fetching user stats:', userErr);
      userStats.error = userErr.message;
    }
    
    // Fetch recent items for the table
    let items = [];
    try {
      items = await Item.find()
        .sort({ createdAt: 'desc' })
        .limit(5)
        .populate('user', 'email name')
        .exec();
    } catch (itemsErr) {
      console.error('Error fetching items for table:', itemsErr);
    }
    
    // Render the MongoDB Atlas admin dashboard
    res.render('admin/mongo_dashboard', {
      dbHealth,
      itemStats,
      userStats,
      items,
      moment: require('moment'),
      user: req.user,
      title: 'MongoDB Atlas Admin Dashboard'
    });
  } catch (err) {
    console.error('MongoDB Atlas Admin dashboard error:', err);
    res.status(500).render('error', {
      message: 'Error loading MongoDB Atlas Admin dashboard',
      error: err
    });
  }
});

module.exports = router;
