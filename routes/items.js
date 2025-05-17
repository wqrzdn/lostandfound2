const express = require('express');
const router = express.Router();
const path = require('path');
const moment = require('moment');
const fs = require('fs');
const Item = require('../models/Item');
const mongoose = require('mongoose');
const User = require('../models/User');

/**
 * Item routes for Lost and Found application
 * All routes use MongoDB with Mongoose
 */
const itemRoutes = {
  // Initialize with upload middleware
  init: function(upload) {
  // Get all items (feed)
  router.get('/', async (req, res) => {
    try {
      // Get filter parameters from query string
      const { type, category, country, state, city, location, date, keyword, seeded, isSchoolArea } = req.query;
      
      console.log('Filter parameters:', req.query); // Debug log
      
      // Build MongoDB filter
      const filter = {};
      if (type) filter.type = type.toLowerCase();
      if (category) {
        if (category === 'School/College') {
          // For School/College filter, we need to ensure we get all relevant items
          // This includes both items explicitly tagged with School/College category
          // and items with isSchoolArea flag
          filter.$or = [
            { category: 'School/College' },
            { isSchoolArea: true }
          ];
        } else {
          filter.category = category;
        }
      }
      if (country) filter.country = country;
      if (state) filter.state = state;
      if (city) filter.city = city;
      if (location) filter.location = new RegExp(location, 'i');
      if (date) filter.date = date;
      if (isSchoolArea === 'true') {
        // If isSchoolArea filter is explicitly applied, we want only school/college items
        if (!filter.$or) {
          filter.isSchoolArea = true;
        }
        // If category filter is already using $or for School/College, we don't need to modify it
      }
      if (keyword) {
        filter.$or = [
          { title: new RegExp(keyword, 'i') },
          { description: new RegExp(keyword, 'i') }
        ];
      }
      
      console.log('MongoDB filter:', filter);
      
      // Execute MongoDB query
      const items = await Item.find(filter).sort({ createdAt: -1 });
      
      console.log(`Found ${items.length} items in MongoDB`);
      
      // Check if we need to add sample data
      if (items.length === 0 && Object.keys(req.query).length === 0) {
        const count = await Item.countDocuments();
        if (count === 0) {
          console.log('MongoDB is empty, adding test items');
          
          // Create sample lost wallet
          await new Item({
            title: 'Lost Wallet',
            description: 'Black leather wallet with ID cards',
            category: 'Wallet',
            location: 'Downtown Area',
            country: 'United States',
            state: 'California',
            city: 'Los Angeles',
            date: '2023-05-15',
            contact: 'contact@example.com',
            type: 'lost',
            createdAt: moment().subtract(1, 'day').toDate()
          }).save();
          
          // Create sample found keys
          await new Item({
            title: 'Found Keys',
            description: 'Set of keys with a blue keychain',
            category: 'Keys',
            location: 'Central Park',
            country: 'United States',
            state: 'New York',
            city: 'New York City',
            date: '2023-04-20',
            contact: 'finder@example.com',
            type: 'found',
            createdAt: moment().subtract(3, 'hours').toDate()
          }).save();
          
          // Fetch items again
          const seededItems = await Item.find().sort({ createdAt: -1 });
          
          return res.render('items/index', {
            items: seededItems,
            type, category, country, state, city, location, date, keyword, 
            isSchoolArea: typeof isSchoolArea !== 'undefined' ? isSchoolArea : 'false',
            moment,
            message: 'Welcome! We\'ve added some sample items to get you started.'
          });
        }
      }
      
      res.render('items/index', {
        items,
        type, category, country, state, city, location, date, keyword, 
        isSchoolArea: typeof isSchoolArea !== 'undefined' ? isSchoolArea : 'false',
        moment,
        message: seeded === 'true' ? 'Test items added successfully!' : null
      });
    } catch (error) {
      console.error('Error in items index route:', error);
      res.status(500).render('error', {
        message: 'Server error',
        error: error
      });
    }
  });

  // Display form to create a new item
  router.get('/new', (req, res) => {
    res.render('items/new', { req });
  });

  // Create a new item
  router.post('/', upload.array('images', 2), async (req, res) => {
    try {
      console.log('POST /items - Form submission received');
      console.log('Request body:', req.body);
      console.log('Files:', req.files ? req.files.length : 0);
      
      // Check if it's a School/College form submission
      const isSchoolArea = req.body.isSchoolArea === 'true';
      
      let title, description, category, location, date, contact, type;
      let country, state, city, locality;
      
      if (isSchoolArea) {
        // Handle School/College form data
        const { schoolName, schoolLocation, schoolDate, schoolItemDescription, schoolContact } = req.body;
        
        // Map school form fields to standard item fields
        title = `School/College Item: ${schoolItemDescription && schoolItemDescription.substring(0, 50)}...`;
        description = schoolItemDescription;
        category = 'Other'; // Default category for school items
        location = schoolLocation;
        date = schoolDate;
        contact = schoolContact;
        type = req.body.type || 'Lost'; // Default to Lost if not specified
        
        // Set school fields
        country = "School/College Area";
        state = schoolName;
        city = schoolLocation;
      } else {
        // Handle standard form data
        const extractedData = req.body;
        title = extractedData.title;
        description = extractedData.description;
        category = extractedData.category;
        location = extractedData.location;
        date = extractedData.date;
        contact = extractedData.contact;
        type = extractedData.type;
        
        // Use the name values instead of codes
        country = extractedData.countryName || extractedData.country;
        state = extractedData.stateName || extractedData.state;
        city = extractedData.cityName || extractedData.city;
        locality = extractedData.locality;
      }
      
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
        image1 = `/uploads/${path.basename(req.files[0].path)}`;
        if (req.files.length > 1) {
          image2 = `/uploads/${path.basename(req.files[1].path)}`;
        }
      }
      
      // Prepare formatted location string
      let formattedLocation = `${city}, ${state}, ${country}`;
      if (locality && locality.trim() !== '') {
        formattedLocation = `${locality}, ${formattedLocation}`;
      }
      
      // Create new item in MongoDB
      const newItem = new Item({
        title,
        description,
        category,
        location: formattedLocation,
        country,
        state,
        city,
        locality: locality || undefined,
        date,
        contact,
        type: type.toLowerCase(),
        image1,
        image2,
        createdAt: new Date(),
        isSchoolArea, // Add the isSchoolArea flag
        schoolName: isSchoolArea ? state : undefined, // If school area, use state as school name
        schoolLocation: isSchoolArea ? city : undefined, // If school area, use city as school location
        status: 'active'
      });
      
      // Add coordinates if latitude and longitude are provided
      const latitude = req.body.latitude;
      const longitude = req.body.longitude;
      if (latitude && longitude) {
        newItem.coordinates = {
          type: 'Point',
          coordinates: [parseFloat(longitude), parseFloat(latitude)] // GeoJSON format is [longitude, latitude]
        };
      }
      
      console.log('Attempting to save item to database...');
      const savedItem = await newItem.save();
      console.log('Item saved successfully with ID:', savedItem._id);
      
      // If user is logged in, associate item with user
      if (req.user) {
        console.log('Associating item with user:', req.user._id);
        await User.findByIdAndUpdate(req.user._id, {
          $push: { items: savedItem._id }
        });
      }
      
      console.log('Redirecting to item page...');
      return res.redirect(`/items/${savedItem._id}`);
    } catch (error) {
      console.error('Error creating item:', error);
      res.status(500).render('error', {
        message: 'Error creating item',
        error: error
      });
    }
  });

  // Show item details
  router.get('/:id', async (req, res) => {
    try {
      const id = req.params.id;
      
      // Check if ID is a valid MongoDB ObjectId
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(404).render('error', {
          message: 'Item not found',
          error: { status: 404, message: 'Invalid item ID format' }
        });
      }
      
      // Find the item by ID
      const item = await Item.findById(id);
      
      if (!item) {
        return res.status(404).render('error', {
          message: 'Item not found',
          error: { status: 404, message: 'The requested item does not exist or has been removed.' }
        });
      }
      
      // Find possible matches
      const matchType = item.type === 'lost' ? 'found' : 'lost';
      const matches = await Item.find({ 
        type: matchType, 
        category: item.category,
        _id: { $ne: item._id }
      })
      .sort({ createdAt: -1 })
      .limit(3);
      
      res.render('items/show', {
        item,
        matches,
        moment
      });
    } catch (error) {
      console.error('Error in item details route:', error);
      res.status(500).render('error', {
        message: 'Error retrieving item details',
        error: error
      });
    }
  });

  // Edit item form
  router.get('/:id/edit', async (req, res) => {
    try {
      const id = req.params.id;
      
      // Check if ID is a valid MongoDB ObjectId
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(404).render('error', {
          message: 'Item not found',
          error: { status: 404, message: 'Invalid item ID format' }
        });
      }
      
      const item = await Item.findById(id);
      
      if (!item) {
        return res.status(404).render('error', {
          message: 'Item not found',
          error: { status: 404, message: 'The requested item does not exist or has been removed.' }
        });
      }
      
      // Check if the user is authorized to edit the item (must be the owner or an admin)
      if (req.user && (req.user.role === 'admin' || (item.user && item.user.toString() === req.user._id.toString()))) {
        res.render('items/edit', {
          item,
          req
        });
      } else {
        return res.status(403).render('error', {
          message: 'Access Denied',
          error: { status: 403, message: 'You do not have permission to edit this item. Only the item owner or an administrator can edit items.' }
        });
      }
    } catch (error) {
      console.error('Error in edit item route:', error);
      res.status(500).render('error', {
        message: 'Error retrieving item for editing',
        error: error
      });
    }
  });

  // Update item
  router.put('/:id', upload.array('images', 2), async (req, res) => {
    try {
      const id = req.params.id;
      
      // Check if ID is a valid MongoDB ObjectId
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(404).render('error', {
          message: 'Item not found',
          error: { status: 404, message: 'Invalid item ID format' }
        });
      }
      
      // Get existing item to check ownership
      const existingItem = await Item.findById(id);
      
      if (!existingItem) {
        return res.status(404).render('error', {
          message: 'Item not found',
          error: { status: 404, message: 'The requested item does not exist or has been removed.' }
        });
      }
      
      // Check if the user is authorized to update the item (must be the owner or an admin)
      if (!(req.user && (req.user.role === 'admin' || (existingItem.user && existingItem.user.toString() === req.user._id.toString())))) {
        return res.status(403).render('error', {
          message: 'Access Denied',
          error: { status: 403, message: 'You do not have permission to update this item. Only the item owner or an administrator can update items.' }
        });
      }
      
      const { 
        title, description, category, location, 
        countryName, stateName, cityName, locality,
        date, contact, type, status, latitude, longitude
      } = req.body;
      
      // Use the name values instead of codes
      const country = countryName || req.body.country;
      const state = stateName || req.body.state;
      const city = cityName || req.body.city;
      
      // Validate required fields
      if (!title || !category || !country || !state || !city || !date || !contact || !type) {
        return res.status(400).send('All required fields must be filled');
      }
      
      // Process uploaded images
      let image1 = existingItem.image1;
      let image2 = existingItem.image2;
      
      if (req.files && req.files.length > 0) {
        // Delete old images if they exist and new ones are uploaded
        if (existingItem.image1 && fs.existsSync(path.join(__dirname, '..', 'public', existingItem.image1))) {
          fs.unlinkSync(path.join(__dirname, '..', 'public', existingItem.image1));
        }
        
        image1 = `/uploads/${path.basename(req.files[0].path)}`;
        
        if (req.files.length > 1) {
          if (existingItem.image2 && fs.existsSync(path.join(__dirname, '..', 'public', existingItem.image2))) {
            fs.unlinkSync(path.join(__dirname, '..', 'public', existingItem.image2));
          }
          
          image2 = `/uploads/${path.basename(req.files[1].path)}`;
        }
      }
      
      // Prepare formatted location string
      let formattedLocation = `${city}, ${state}, ${country}`;
      if (locality && locality.trim() !== '') {
        formattedLocation = `${locality}, ${formattedLocation}`;
      }
      
      // Prepare update object
      const updateData = {
        title,
        description,
        category,
        location: formattedLocation,
        country,
        state,
        city,
        locality: locality || undefined,
        date,
        contact,
        type: type.toLowerCase(),
        status: status || 'active',
        image1,
        image2,
        updatedAt: new Date()
      };
      
      // Add coordinates if latitude and longitude are provided
      if (latitude && longitude) {
        updateData.coordinates = {
          type: 'Point',
          coordinates: [parseFloat(longitude), parseFloat(latitude)] // GeoJSON format is [longitude, latitude]
        };
      }
      
      // Update the item
      const updatedItem = await Item.findByIdAndUpdate(id, updateData, { new: true });
      
      res.redirect(`/items/${updatedItem._id}`);
    } catch (error) {
      console.error('Error updating item:', error);
      res.status(500).render('error', {
        message: 'Error updating item',
        error: error
      });
    }
  });

  // Delete item
  router.delete('/:id', async (req, res) => {
    try {
      const id = req.params.id;
      
      // Check if ID is a valid MongoDB ObjectId
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(404).render('error', {
          message: 'Item not found',
          error: { status: 404, message: 'Invalid item ID format' }
        });
      }
      
      // Get the item to delete
      const item = await Item.findById(id);
      
      if (!item) {
        return res.status(404).render('error', {
          message: 'Item not found',
          error: { status: 404, message: 'The requested item does not exist or has been removed.' }
        });
      }
      
      // Check if the user is authorized to delete the item (must be the owner or an admin)
      if (!(req.user && (req.user.role === 'admin' || (item.user && item.user.toString() === req.user._id.toString())))) {
        return res.status(403).render('error', {
          message: 'Access Denied',
          error: { status: 403, message: 'You do not have permission to delete this item. Only the item owner or an administrator can delete items.' }
        });
      }
      
      // Delete associated images
      if (item.image1 && fs.existsSync(path.join(__dirname, '..', 'public', item.image1))) {
        fs.unlinkSync(path.join(__dirname, '..', 'public', item.image1));
      }
      
      if (item.image2 && fs.existsSync(path.join(__dirname, '..', 'public', item.image2))) {
        fs.unlinkSync(path.join(__dirname, '..', 'public', item.image2));
      }
      
      // Remove item from user's items array if associated with a user
      if (item.user) {
        await User.findByIdAndUpdate(item.user, {
          $pull: { items: item._id }
        });
      }
      
      // Delete the item
      await Item.findByIdAndDelete(id);
      
      res.redirect('/items');
    } catch (error) {
      console.error('Error deleting item:', error);
      res.status(500).render('error', {
        message: 'Error deleting item',
        error: error
      });
    }
  });

  // Mark item as resolved
  router.post('/:id/resolve', async (req, res) => {
    try {
      const id = req.params.id;
      
      // Check if ID is a valid MongoDB ObjectId
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(404).render('error', {
          message: 'Item not found',
          error: { status: 404, message: 'Invalid item ID format' }
        });
      }
      
      // Get the item to check ownership
      const item = await Item.findById(id);
      
      if (!item) {
        return res.status(404).render('error', {
          message: 'Item not found',
          error: { status: 404, message: 'The requested item does not exist or has been removed.' }
        });
      }
      
      // Check if the user is authorized to resolve the item (must be the owner or an admin)
      if (!(req.user && (req.user.role === 'admin' || (item.user && item.user.toString() === req.user._id.toString())))) {
        return res.status(403).render('error', {
          message: 'Access Denied',
          error: { status: 403, message: 'You do not have permission to resolve this item. Only the item owner or an administrator can resolve items.' }
        });
      }
      
      // Update the item status
      const updatedItem = await Item.findByIdAndUpdate(id, {
        status: 'resolved',
        updatedAt: new Date()
      }, { new: true });
      
      res.redirect(`/items/${id}`);
    } catch (error) {
      console.error('Error resolving item:', error);
      res.status(500).render('error', {
        message: 'Error resolving item',
        error: error
      });
    }
  });

  // Search items
  router.get('/search', async (req, res) => {
    try {
      const { q } = req.query;
      
      if (!q) {
        return res.redirect('/items');
      }
      
      // Perform text search
      const items = await Item.find({
        $text: { $search: q }
      }, {
        score: { $meta: 'textScore' }
      })
      .sort({ score: { $meta: 'textScore' } })
      .limit(20);
      
      res.render('items/search-results', {
        items,
        query: q,
        moment
      });
    } catch (error) {
      console.error('Error searching items:', error);
      res.status(500).render('error', {
        message: 'Error searching items',
        error: error
      });
    }
  });

    return router;
  },
  
  // Router getter methods for specific HTTP methods
  get: function(req, res, next) {
    // Handle GET routes without authentication requirement
    const path = req.path;
    if (path === '/' || path.match(/^/[a-f0-9]{24}$/)) {
      // Allow public access to browse items and view item details
      return router.handle(req, res, next);
    }
    // For other GET routes, require authentication (handled by middleware)
    next();
  },
  
  post: function(req, res, next) {
    // All POST routes require authentication (handled by middleware)
    router.handle(req, res, next);
  },
  
  put: function(req, res, next) {
    // All PUT routes require authentication (handled by middleware)
    router.handle(req, res, next);
  },
  
  delete: function(req, res, next) {
    // All DELETE routes require authentication (handled by middleware)
    router.handle(req, res, next);
  }
};

// Export the router with proper configuration
module.exports = function(upload) {
  return itemRoutes.init(upload);
};
