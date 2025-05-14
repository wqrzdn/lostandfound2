/**
 * Admin routes for database management and system administration
 */

const express = require('express');
const router = express.Router();
const { 
  cleanupDatabase,
  checkDatabaseHealth,
  createDatabaseBackup
} = require('../utils/database');
const Item = require('../models/Item');
const User = require('../models/User');
const path = require('path');
const fs = require('fs');

// Middleware to check admin authorization
const isAdmin = async (req, res, next) => {
  try {
    console.log('Admin auth check - User:', req.user ? `${req.user.email} (${req.user.role})` : 'Not logged in');
    
    // Check if user is logged in
    if (!req.user) {
      console.log('Admin access denied: User not logged in');
      
      // Instead of redirecting to login, render an access denied page
      return res.status(401).render('error', {
        message: 'Authentication Required',
        error: { 
          status: 401, 
          stack: 'You must be logged in to access the admin dashboard. Please login with an admin account.'
        }
      });
    }
    
    // Check if user is an admin
    if (req.user.role !== 'admin') {
      console.log('Admin access denied: User not an admin');
      return res.status(403).render('error', {
        message: 'Access Denied',
        error: { 
          status: 403, 
          stack: 'You do not have administrator privileges to access this area.' 
        }
      });
    }
    
    console.log('Admin access granted to:', req.user.email);
    next();
  } catch (err) {
    console.error('Admin auth error:', err);
    res.status(500).render('error', {
      message: 'Server Error',
      error: err
    });
  }
};

// Admin dashboard
router.get('/dashboard', isAdmin, async (req, res) => {
  try {
    console.log('Admin dashboard accessed by:', req.user ? req.user.email : 'Unknown user');
    
    // Check if user is authenticated
    if (!req.user) {
      console.log('No user found in request - authentication issue');
      return res.status(401).render('error', {
        message: 'Authentication required',
        error: { status: 401, stack: 'You must be logged in to access this page' }
      });
    }
    
    console.log('User role:', req.user.role);
    
    // Get database stats
    console.log('Fetching database health...');
    const dbHealth = await checkDatabaseHealth();
    console.log('Database health:', JSON.stringify(dbHealth));
    
    // Get item stats with error handling
    console.log('Fetching item stats...');
    const itemStats = {};
    try {
      itemStats.total = await Item.countDocuments();
      itemStats.lost = await Item.countDocuments({ type: 'lost' });
      itemStats.found = await Item.countDocuments({ type: 'found' });
      itemStats.active = await Item.countDocuments({ status: 'active' });
      itemStats.resolved = await Item.countDocuments({ status: 'resolved' });
      itemStats.expired = await Item.countDocuments({ status: 'expired' });
      console.log('Item stats:', JSON.stringify(itemStats));
    } catch (itemErr) {
      console.error('Error fetching item stats:', itemErr);
      itemStats.error = itemErr.message;
    }
    
    // Get user stats with error handling
    console.log('Fetching user stats...');
    const userStats = {};
    try {
      userStats.total = await User.countDocuments();
      userStats.admins = await User.countDocuments({ role: 'admin' });
      userStats.active = await User.countDocuments({ isActive: true });
      userStats.inactive = await User.countDocuments({ isActive: false });
      console.log('User stats:', JSON.stringify(userStats));
    } catch (userErr) {
      console.error('Error fetching user stats:', userErr);
      userStats.error = userErr.message;
    }
    
    // Fetch ALL items for the table
    console.log('Fetching all items for table...');
    let items = [];
    try {
      items = await Item.find()
        .sort({ createdAt: 'desc' })
        .populate('user', 'email name')  // Add user data for display
        .exec();
        
      console.log('Fetched', items.length, 'items for table');
    } catch (itemsErr) {
      console.error('Error fetching items for table:', itemsErr);
    }
    
    console.log('Rendering admin dashboard...');
    // Use the standalone dashboard which has its own complete HTML structure
    res.render('admin/standalone_dashboard', {
      dbHealth,
      itemStats,
      userStats,
      items,
      moment: require('moment'),
      user: req.user,
      layout: false  // This tells EJS to not use any layout - important for standalone template
    });
  } catch (err) {
    console.error('Admin dashboard error:', err);
    res.status(500).render('error', {
      message: 'Error loading admin dashboard',
      error: err
    });
  }
});

// Database cleanup page
router.get('/cleanup', isAdmin, async (req, res) => {
  try {
    const dbHealth = await checkDatabaseHealth();
    res.render('admin/cleanup', {
      dbHealth,
      user: req.user
    });
  } catch (err) {
    console.error('Cleanup page error:', err);
    res.status(500).render('error', {
      message: 'Error loading cleanup page',
      error: err
    });
  }
});

// Perform database cleanup
router.post('/cleanup', isAdmin, async (req, res) => {
  try {
    const { daysOld } = req.body;
    
    // Create backup before cleanup
    await createDatabaseBackup();
    
    // Perform cleanup
    const result = await cleanupDatabase(daysOld || 180);
    
    res.render('admin/cleanup-result', {
      result,
      database: 'mongodb',
      user: req.user
    });
  } catch (err) {
    console.error('Cleanup error:', err);
    res.status(500).render('error', {
      message: 'Error during database cleanup',
      error: err
    });
  }
});

// Database backup page
router.get('/backup', isAdmin, async (req, res) => {
  try {
    // Get list of existing backups
    const backupDir = path.join(__dirname, '..', 'backups');
    let backups = [];
    
    if (fs.existsSync(backupDir)) {
      const files = fs.readdirSync(backupDir);
      backups = files.map(file => {
        const stats = fs.statSync(path.join(backupDir, file));
        return {
          name: file,
          size: stats.size,
          date: stats.mtime
        };
      }).sort((a, b) => b.date - a.date); // Sort by date, newest first
    }
    
    res.render('admin/backup', {
      backups,
      user: req.user
    });
  } catch (err) {
    console.error('Backup page error:', err);
    res.status(500).render('error', {
      message: 'Error loading backup page',
      error: err
    });
  }
});

// Create database backup
router.post('/backup', isAdmin, async (req, res) => {
  try {
    const result = await createDatabaseBackup();
    
    res.render('admin/backup-result', {
      result,
      user: req.user
    });
  } catch (err) {
    console.error('Backup error:', err);
    res.status(500).render('error', {
      message: 'Error creating database backup',
      error: err
    });
  }
});

// User management page
router.get('/users', isAdmin, async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    
    res.render('admin/standalone_users', {
      users,
      user: req.user,
      layout: false  // This tells EJS to not use any layout
    });
  } catch (err) {
    console.error('User management error:', err);
    res.status(500).render('error', {
      message: 'Error loading user management page',
      error: err
    });
  }
});

// Toggle user active status
router.post('/users/:id/toggle-status', isAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).render('error', {
        message: 'User not found',
        error: { status: 404 }
      });
    }
    
    // Toggle active status
    user.isActive = !user.isActive;
    await user.save();
    
    res.redirect('/admin/users');
  } catch (err) {
    console.error('Toggle user status error:', err);
    res.status(500).render('error', {
      message: 'Error toggling user status',
      error: err
    });
  }
});

// Change user role
router.post('/users/:id/change-role', isAdmin, async (req, res) => {
  try {
    const { role } = req.body;
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).render('error', {
        message: 'User not found',
        error: { status: 404 }
      });
    }
    
    // Change role
    user.role = role;
    await user.save();
    
    res.redirect('/admin/users');
  } catch (err) {
    console.error('Change user role error:', err);
    res.status(500).render('error', {
      message: 'Error changing user role',
      error: err
    });
  }
});

// Change item status
router.get('/items/:id/status/:status', isAdmin, async (req, res) => {
  try {
    const { id, status } = req.params;
    
    // Validate status
    const validStatuses = ['active', 'resolved', 'expired'];
    if (!validStatuses.includes(status)) {
      return res.status(400).render('error', {
        message: 'Invalid status',
        error: { status: 400 }
      });
    }
    
    // Find and update item
    const item = await Item.findById(id);
    
    if (!item) {
      return res.status(404).render('error', {
        message: 'Item not found',
        error: { status: 404 }
      });
    }
    
    // Update status
    item.status = status;
    await item.save();
    
    // Redirect back to dashboard
    res.redirect('/admin/dashboard');
  } catch (err) {
    console.error('Change item status error:', err);
    res.status(500).render('error', {
      message: 'Error changing item status',
      error: err
    });
  }
});

// Admin Item Management Routes

// View all items with management options
router.get('/items', isAdmin, async (req, res) => {
  try {
    console.log('Admin accessing all items');
    const items = await Item.find().sort({ createdAt: 'desc' }).populate('user', 'name email');
    
    res.render('admin/standalone_items', {
      items,
      moment: require('moment'),
      title: 'Manage All Items',
      user: req.user,
      layout: false  // This tells EJS to not use any layout
    });
  } catch (error) {
    console.error('Error in admin items view:', error);
    res.status(500).render('error', {
      message: 'Server Error',
      error
    });
  }
});

// Admin Edit Item Route
router.get('/items/:id/edit', isAdmin, async (req, res) => {
  try {
    const item = await Item.findById(req.params.id).exec();
    
    if (!item) {
      return res.status(404).render('error', {
        message: 'Item not found',
        error: { status: 404 }
      });
    }
    
    console.log('Admin editing item:', item._id);
    res.render('items/edit', {
      item,
      req,
      adminMode: true
    });
  } catch (error) {
    console.error('Admin edit error:', error);
    res.status(500).render('error', {
      message: 'Error retrieving item',
      error
    });
  }
});

// Admin Delete Item Route
router.delete('/items/:id', isAdmin, async (req, res) => {
  try {
    const item = await Item.findById(req.params.id).exec();
    
    if (!item) {
      return res.status(404).render('error', {
        message: 'Item not found',
        error: { status: 404 }
      });
    }
    
    // Delete images if they exist
    if (item.image1) {
      const imagePath1 = path.join(__dirname, '..', 'public', item.image1);
      if (fs.existsSync(imagePath1)) {
        fs.unlinkSync(imagePath1);
      }
    }
    
    if (item.image2) {
      const imagePath2 = path.join(__dirname, '..', 'public', item.image2);
      if (fs.existsSync(imagePath2)) {
        fs.unlinkSync(imagePath2);
      }
    }
    
    // Remove item from user's items array if it belongs to a user
    if (item.user) {
      await User.findByIdAndUpdate(item.user, {
        $pull: { items: item._id }
      });
    }
    
    // Delete the item
    await Item.findByIdAndDelete(req.params.id);
    
    console.log('Admin deleted item:', req.params.id);
    req.flash('success', 'Item deleted successfully');
    res.redirect('/admin/items');
  } catch (error) {
    console.error('Admin delete error:', error);
    res.status(500).render('error', {
      message: 'Error deleting item',
      error
    });
  }
});

// Debug route for admin deletion testing
router.get('/test-delete', isAdmin, (req, res) => {
  res.render('admin/test-delete', {
    req,
    title: 'Admin Delete Test'
  });
});

// Process direct item deletion for debugging
router.post('/test-delete', isAdmin, async (req, res) => {
  const { itemId } = req.body;
  const testResult = { success: false };
  
  try {
    console.log('DEBUG: Admin test delete for item ID:', itemId);
    testResult.itemId = itemId;
    
    // Find the item
    const item = await Item.findById(itemId);
    if (!item) {
      testResult.error = 'Item not found';
      console.log('DEBUG: Item not found');
      return res.render('admin/test-delete', { req, testResult, title: 'Admin Delete Test' });
    }
    
    testResult.item = {
      title: item.title,
      type: item.type,
      user: item.user ? item.user.toString() : null
    };
    
    console.log('DEBUG: Found item:', item.title);
    console.log('DEBUG: Item owner:', item.user ? item.user.toString() : 'No owner');
    console.log('DEBUG: Admin user:', req.user._id.toString());
    
    // Delete images if they exist
    if (item.image1) {
      const imagePath1 = path.join(__dirname, '..', 'public', item.image1);
      if (fs.existsSync(imagePath1)) {
        fs.unlinkSync(imagePath1);
        console.log('DEBUG: Deleted image1');
      }
    }
    
    if (item.image2) {
      const imagePath2 = path.join(__dirname, '..', 'public', item.image2);
      if (fs.existsSync(imagePath2)) {
        fs.unlinkSync(imagePath2);
        console.log('DEBUG: Deleted image2');
      }
    }
    
    // Remove item from user's items array if it belongs to a user
    if (item.user) {
      await User.findByIdAndUpdate(item.user, {
        $pull: { items: item._id }
      });
      console.log('DEBUG: Removed item from user\'s items array');
    }
    
    // Delete the item
    await Item.findByIdAndDelete(itemId);
    console.log('DEBUG: Item deleted successfully');
    
    testResult.success = true;
    testResult.message = 'Item deleted successfully!';
    
  } catch (error) {
    console.error('DEBUG ERROR:', error);
    testResult.error = error.message;
    testResult.stack = error.stack;
  }
  
  res.render('admin/test-delete', {
    req,
    testResult,
    title: 'Admin Delete Test'
  });
});

// Admin Users Management Page
router.get('/users', isAdmin, async (req, res) => {
  try {
    // Fetch all users from the database
    const users = await User.find().sort({ createdAt: 'desc' }).exec();
    
    res.render('admin/users', {
      users,
      user: req.user
    });
  } catch (err) {
    console.error('Error loading users page:', err);
    res.status(500).render('error', {
      message: 'Error loading users page',
      error: err
    });
  }
});

// Admin User Edit Route
router.get('/users/:id/edit', isAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).exec();
    
    if (!user) {
      return res.status(404).render('error', {
        message: 'User not found',
        error: { status: 404 }
      });
    }
    
    res.render('admin/edit-user', {
      targetUser: user,
      user: req.user
    });
  } catch (err) {
    console.error('Error loading user edit page:', err);
    res.status(500).render('error', {
      message: 'Error loading user edit page',
      error: err
    });
  }
});

// Admin User Update Route
router.put('/users/:id', isAdmin, async (req, res) => {
  try {
    const { name, email, role, isActive } = req.body;
    
    // Update user
    await User.findByIdAndUpdate(req.params.id, {
      name,
      email,
      role,
      isActive: !!isActive
    });
    
    req.flash('success', 'User updated successfully');
    res.redirect('/admin/users');
  } catch (err) {
    console.error('Error updating user:', err);
    res.status(500).render('error', {
      message: 'Error updating user',
      error: err
    });
  }
});

// Admin Settings Page
router.get('/settings', isAdmin, async (req, res) => {
  try {
    res.render('admin/settings', {
      user: req.user
    });
  } catch (err) {
    console.error('Error loading settings page:', err);
    res.status(500).render('error', {
      message: 'Error loading settings page',
      error: err
    });
  }
});

// Admin Settings Update Route
router.post('/settings', isAdmin, async (req, res) => {
  try {
    // Here you would update application settings
    // For now, we'll just show a success message
    req.flash('success', 'Settings updated successfully');
    res.redirect('/admin/settings');
  } catch (err) {
    console.error('Error updating settings:', err);
    res.status(500).render('error', {
      message: 'Error updating settings',
      error: err
    });
  }
});

module.exports = router;
