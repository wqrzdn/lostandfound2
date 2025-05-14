const express = require('express');
const router = express.Router();
const path = require('path');
const moment = require('moment');
const fs = require('fs');
const Item = require('../models/Item');
const mongoose = require('mongoose');
const User = require('../models/User');
const checkPermission = require('../middleware/checkPermission');

/**
 * Item routes for Lost and Found application
 * All routes use MongoDB with Mongoose
 */
module.exports = function(upload) {
  // ALL ROUTES REQUIRE AUTHENTICATION
  
  // Authentication check middleware for all routes
  router.use(checkAuthenticated);
  
  // ---------- ENSURE SPECIFIC ROUTES COME BEFORE PATTERN ROUTES ----------
  
  // Display form to create a new item - Requires login
  router.get('/new', (req, res) => {
    res.render('items/new', { req });
  });
  
  // Get user's own items - Requires login
  router.get('/my-items', async (req, res) => {
    try {
      const userItems = await Item.find({ user: req.user._id })
        .sort({ createdAt: 'desc' })
        .exec();
        
      res.render('items/my-items', {
        items: userItems,
        moment
      });
    } catch (error) {
      console.error('Error getting user items:', error);
      req.flash('error', 'Failed to retrieve your items');
      res.redirect('/items');
    }
  });
  
  // ---------- GENERAL ROUTES BELOW ----------
  
  // Get all items (feed) - Now requires authentication
  router.get('/', async (req, res) => {
    try {
      // Get filter parameters from query string
      const { type, category, country, state, city, location, date, keyword, seeded } = req.query;
      
      console.log('Filter parameters:', req.query); // Debug log
      
      // Build MongoDB filter
      const filter = {};
      if (type) filter.type = type.toLowerCase();
      if (category) filter.category = category;
      if (country) filter.country = country;
      if (state) filter.state = state;
      if (city) filter.city = city;
      if (location) filter.location = new RegExp(location, 'i');
      if (date) filter.date = date;
      
      // Build text search if keyword is provided
      if (keyword) {
        filter.$or = [
          { title: new RegExp(keyword, 'i') },
          { description: new RegExp(keyword, 'i') },
          { category: new RegExp(keyword, 'i') },
          { location: new RegExp(keyword, 'i') }
        ];
      }
      
      // Get all items matching filter
      const items = await Item.find(filter)
        .sort({ createdAt: 'desc' })
        .limit(50)
        .exec();
      
      console.log(`Found ${items.length} items`);
      
      res.render('items/index', {
        items,
        filter: req.query,
        moment,
        req
      });
    } catch (error) {
      console.error('Error getting items:', error);
      res.status(500).render('error', {
        message: 'Failed to retrieve items',
        error: error
      });
    }
  });
  
  // Show single item
  router.get('/:id', async (req, res) => {
    try {
      const item = await Item.findById(req.params.id).exec();
      
      if (!item) {
        return res.status(404).render('error', {
          message: 'Item not found',
          error: { status: 404 }
        });
      }
      
      // Find potential matches
      const matchType = item.type === 'Lost' ? 'Found' : 'Lost';
      const matchCategory = item.category;
      
      // Build match query
      const matchQuery = {
        type: matchType,
        category: matchCategory,
        _id: { $ne: item._id } // Exclude current item
      };
      
      // Add location filters if available
      if (item.country) matchQuery.country = item.country;
      if (item.state) matchQuery.state = item.state;
      if (item.city) matchQuery.city = item.city;
      
      // Find potential matches
      const potentialMatches = await Item.find(matchQuery)
        .sort({ createdAt: 'desc' })
        .limit(3)
        .exec();
      
      res.render('items/show', {
        item,
        potentialMatches,
        moment,
        req
      });
    } catch (error) {
      console.error('Error showing item:', error);
      res.status(500).render('error', {
        message: 'Server error',
        error: error
      });
    }
  });
  
  // PROTECTED ROUTES - Authentication required
  
  // Edit item form - Requires login and ownership OR admin role
  router.get('/:id/edit', checkAuthenticated, async (req, res) => {
    try {
      const item = await Item.findById(req.params.id).exec();
      
      if (!item) {
        return res.status(404).render('error', {
          message: 'Item not found',
          error: { status: 404 }
        });
      }
      
      // Check permissions - ADMIN CHECK ADDED
      // Admins can edit any item, regular users can only edit their own
      if (req.user && item.user && 
          req.user.role !== 'admin' && // Add admin bypass check
          item.user.toString() !== req.user._id.toString()) {
        console.log('Edit permission denied. User role:', req.user.role, 'User ID:', req.user._id, 'Item owner ID:', item.user);
        req.flash('error', 'You do not have permission to edit this item');
        return res.redirect(`/items/${item._id}`);
      }
      console.log('Edit permission granted to user:', req.user.email, 'Role:', req.user.role);
      
      res.render('items/edit', {
        item,
        req
      });
    } catch (error) {
      console.error('Error showing edit form:', error);
      res.status(500).render('error', {
        message: 'Server error',
        error: error
      });
    }
  });
  
  // Update item - Requires login and ownership OR admin role
  router.put('/:id', checkAuthenticated, upload.array('images', 2), async (req, res) => {
    try {
      const item = await Item.findById(req.params.id).exec();
      
      if (!item) {
        return res.status(404).render('error', {
          message: 'Item not found',
          error: { status: 404 }
        });
      }
      
      // Check permissions - ADMIN CHECK ADDED
      // Admins can update any item, regular users can only update their own
      if (req.user && item.user && 
          req.user.role !== 'admin' && // Add admin bypass check
          item.user.toString() !== req.user._id.toString()) {
        console.log('Update permission denied. User role:', req.user.role);
        req.flash('error', 'You do not have permission to edit this item');
        return res.redirect(`/items/${item._id}`);
      }
      console.log('Update permission granted to user:', req.user.email, 'Role:', req.user.role);
      
      // Update item fields
      const { 
        title, description, category, location, 
        countryName, stateName, cityName, locality,
        date, contact, type, latitude, longitude
      } = req.body;
      
      // Use the name values instead of codes
      const country = countryName || req.body.country;
      const state = stateName || req.body.state;
      const city = cityName || req.body.city;
      
      // Update basic fields
      item.title = title;
      item.description = description;
      item.category = category;
      item.type = type.toLowerCase();
      item.location = location || city || country || 'Unknown location';
      item.country = country;
      item.state = state;
      item.city = city;
      item.locality = locality;
      item.date = date;
      item.contact = contact;
      item.coordinates.latitude = latitude || null;
      item.coordinates.longitude = longitude || null;
      
      // Process uploaded images if any
      if (req.files && req.files.length > 0) {
        // Handle image1
        if (req.files[0]) {
          // Delete old image if exists
          if (item.image1) {
            const oldImagePath = path.join(__dirname, '..', 'public', item.image1);
            if (fs.existsSync(oldImagePath)) {
              fs.unlinkSync(oldImagePath);
            }
          }
          item.image1 = '/uploads/' + path.basename(req.files[0].path);
        }
        
        // Handle image2
        if (req.files[1]) {
          // Delete old image if exists
          if (item.image2) {
            const oldImagePath = path.join(__dirname, '..', 'public', item.image2);
            if (fs.existsSync(oldImagePath)) {
              fs.unlinkSync(oldImagePath);
            }
          }
          item.image2 = '/uploads/' + path.basename(req.files[1].path);
        }
      }
      
      // Save updated item
      await item.save();
      
      req.flash('success', 'Item updated successfully');
      res.redirect(`/items/${item._id}`);
    } catch (error) {
      console.error('Error updating item:', error);
      res.status(500).render('error', {
        message: 'Failed to update item',
        error: error
      });
    }
  });
  
  // Delete item - Requires login and ownership OR admin role
  router.delete('/:id', checkAuthenticated, async (req, res) => {
    try {
      const item = await Item.findById(req.params.id).exec();
      
      if (!item) {
        return res.status(404).render('error', {
          message: 'Item not found',
          error: { status: 404 }
        });
      }
      
      // Check permissions - ADMIN CHECK ADDED
      // Admins can delete any item, regular users can only delete their own
      if (req.user && item.user && 
          req.user.role !== 'admin' && // Add admin bypass check
          item.user.toString() !== req.user._id.toString()) {
        console.log('Delete permission denied. User role:', req.user.role);
        req.flash('error', 'You do not have permission to delete this item');
        return res.redirect(`/items/${item._id}`);
      }
      console.log('Delete permission granted to user:', req.user.email, 'Role:', req.user.role);
      
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
      
      // Remove item from user's items array
      if (item.user) {
        await User.findByIdAndUpdate(item.user, {
          $pull: { items: item._id }
        });
      }
      
      // Delete the item
      await Item.findByIdAndDelete(req.params.id);
      
      req.flash('success', 'Item deleted successfully');
      res.redirect('/items');
    } catch (error) {
      console.error('Error deleting item:', error);
      res.status(500).render('error', {
        message: 'Failed to delete item',
        error: error
      });
    }
  });
  
  // Create a new item - Requires login
  router.post('/', checkAuthenticated, upload.array('images', 2), async (req, res) => {
    try {
      console.log('POST /items - Form submission received');
      console.log('Request body:', req.body);
      console.log('Files:', req.files ? req.files.length : 0);
      
      const { 
        title, description, category, location, 
        countryName, stateName, cityName, locality,
        date, contact, type, latitude, longitude
      } = req.body;
      
      // Use the name values instead of codes
      const country = countryName || req.body.country;
      const state = stateName || req.body.state;
      const city = cityName || req.body.city;
      
      console.log('Extracted data:', { title, category, country, state, city, date, contact, type });
      
      // Validate required fields
      if (!title || !category || !country || !state || !city || !date || !contact || !type) {
        console.error('Validation failed - missing required fields');
        return res.status(400).send('All required fields must be filled');
      }
      
      // Process uploaded images
      let image1 = null;
      let image2 = null;
      
      if (req.files && req.files.length > 0) {
        image1 = '/uploads/' + path.basename(req.files[0].path);
        if (req.files.length > 1) {
          image2 = '/uploads/' + path.basename(req.files[1].path);
        }
      }
      
      // Create new item with better error handling
      try {
        console.log('Creating new item with user:', req.user ? req.user.email : 'No user');
        
        // Create new item document
        const newItem = new Item({
          title,
          description,
          category,
          type: type.toLowerCase(),
          // Set default location if empty - using city or country name as fallback
          location: location || city || country || 'Unknown location',
          country,
          state,
          city,
          locality,
          date,
          contact,
          image1,
          image2,
          coordinates: {
            latitude: latitude || null,
            longitude: longitude || null
          },
          // Make sure user ID is handled properly
          user: req.user && req.user._id ? req.user._id : null
        });
        
        console.log('Item document created, saving to database...');
        
        // Save item to database
        const savedItem = await newItem.save();
        console.log('Item saved successfully with ID:', savedItem._id);
        
        // If user is logged in, associate item with user
        if (req.user && req.user._id) {
          console.log('Associating item with user:', req.user.email);
          await User.findByIdAndUpdate(req.user._id, {
            $push: { items: savedItem._id }
          });
        }
        
        // Flash success message and redirect
        req.flash('success', 'Item posted successfully');
        return res.redirect('/items/' + savedItem._id);
      } catch (innerError) {
        console.error('Error saving item:', innerError);
        req.flash('error', 'Failed to create item. Please try again.');
        return res.status(500).render('error', {
          message: 'Error saving item',
          error: innerError
        });
      }
    } catch (error) {
      console.error('Error creating item:', error);
      res.status(500).render('error', {
        message: 'Failed to create item',
        error: error
      });
    }
  });
  
  // Search route
  router.get('/search/:keyword', checkAuthenticated, async (req, res) => {
    try {
      const { keyword } = req.params;
      
      // Build search query
      const searchQuery = {
        $or: [
          { title: new RegExp(keyword, 'i') },
          { description: new RegExp(keyword, 'i') },
          { category: new RegExp(keyword, 'i') },
          { location: new RegExp(keyword, 'i') },
          { country: new RegExp(keyword, 'i') },
          { state: new RegExp(keyword, 'i') },
          { city: new RegExp(keyword, 'i') }
        ]
      };
      
      // Get matching items
      const items = await Item.find(searchQuery)
        .sort({ createdAt: 'desc' })
        .limit(50)
        .exec();
      
      res.render('items/search-results', {
        items,
        keyword,
        moment,
        req
      });
    } catch (error) {
      console.error('Error searching items:', error);
      res.status(500).render('error', {
        message: 'Error searching items',
        error: error
      });
    }
  });
  
  // Authentication middleware
  function checkAuthenticated(req, res, next) {
    if (!req.user) {
      // Store the URL the user was trying to access
      req.session.returnTo = req.originalUrl;
      
      // Flash a message
      req.flash('error', 'Please log in to access this feature');
      
      return res.redirect('/auth/login');
    }
    next();
  }
  
  return router;
};
