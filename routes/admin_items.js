/**
 * Dedicated admin item management routes
 * This route file is specifically designed to handle admin item operations
 */

const express = require('express');
const router = express.Router();
const Item = require('../models/Item');
const User = require('../models/User');
const path = require('path');
const fs = require('fs');
const moment = require('moment');

// Middleware to check admin authorization
const isAdmin = async (req, res, next) => {
  try {
    console.log('Admin auth check - User:', req.user ? `${req.user.email} (${req.user.role})` : 'Not logged in');
    
    // Check if user is logged in
    if (!req.user) {
      console.log('Admin access denied: User not logged in');
      return res.status(401).render('error', {
        message: 'Authentication Required',
        error: { status: 401, stack: 'You must be logged in to access the admin dashboard.' }
      });
    }
    
    // Check if user is an admin
    if (req.user.role !== 'admin') {
      console.log('Admin access denied: User not an admin');
      return res.status(403).render('error', {
        message: 'Access Denied',
        error: { status: 403, stack: 'You do not have administrator privileges.' }
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

// View all items
router.get('/', isAdmin, async (req, res) => {
  try {
    console.log('Admin accessing all items list');
    
    const items = await Item.find()
      .populate('user', 'name email') // Get user details for each item
      .sort({ createdAt: -1 })
      .exec();
    
    console.log(`Found ${items.length} items`);
    
    res.render('admin/items', {
      items,
      moment,
      req,
      title: 'Admin Item Management'
    });
  } catch (error) {
    console.error('Error getting admin items list:', error);
    res.status(500).render('error', {
      message: 'Failed to retrieve items',
      error
    });
  }
});

// Edit item form
router.get('/:id/edit', isAdmin, async (req, res) => {
  try {
    console.log('Admin editing item ID:', req.params.id);
    
    const item = await Item.findById(req.params.id);
    if (!item) {
      console.log('Item not found');
      return res.status(404).render('error', {
        message: 'Item not found',
        error: { status: 404 }
      });
    }
    
    console.log('Item found for editing:', item.title);
    
    res.render('admin/edit_item', {
      item,
      req,
      title: 'Edit Item'
    });
  } catch (error) {
    console.error('Error editing item:', error);
    res.status(500).render('error', {
      message: 'Failed to retrieve item for editing',
      error
    });
  }
});

// Update item
router.post('/:id', isAdmin, async (req, res) => {
  try {
    console.log('Admin updating item ID:', req.params.id);
    
    const item = await Item.findById(req.params.id);
    if (!item) {
      console.log('Item not found for update');
      return res.status(404).render('error', {
        message: 'Item not found',
        error: { status: 404 }
      });
    }
    
    // Update item fields
    const { title, description, type, category, location } = req.body;
    
    item.title = title;
    item.description = description;
    item.type = type;
    item.category = category;
    item.location = location;
    
    await item.save();
    console.log('Item updated successfully');
    
    req.flash('success', 'Item updated successfully');
    res.redirect('/admin_items');
  } catch (error) {
    console.error('Error updating item:', error);
    res.status(500).render('error', {
      message: 'Failed to update item',
      error
    });
  }
});

// Delete item
router.get('/:id/delete', isAdmin, async (req, res) => {
  try {
    console.log('Admin direct delete for item ID:', req.params.id);
    
    const item = await Item.findById(req.params.id);
    if (!item) {
      console.log('Item not found for deletion');
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
        console.log('Deleted image1');
      }
    }
    
    if (item.image2) {
      const imagePath2 = path.join(__dirname, '..', 'public', item.image2);
      if (fs.existsSync(imagePath2)) {
        fs.unlinkSync(imagePath2);
        console.log('Deleted image2');
      }
    }
    
    // Remove item from user's items array
    if (item.user) {
      console.log('Removing item from user\'s items array, User ID:', item.user);
      await User.findByIdAndUpdate(item.user, {
        $pull: { items: item._id }
      });
    }
    
    // Delete the item
    await Item.findByIdAndDelete(req.params.id);
    console.log('Item successfully deleted');
    
    req.flash('success', 'Item deleted successfully');
    res.redirect('/admin_items');
  } catch (error) {
    console.error('Error deleting item:', error);
    res.status(500).render('error', {
      message: 'Failed to delete item',
      error
    });
  }
});

module.exports = router;
