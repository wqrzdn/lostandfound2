const express = require('express');
const router = express.Router();
const path = require('path');
const moment = require('moment');
const fs = require('fs');
const Item = require('../models/Item'); // Import the Mongoose Item model
const mongoose = require('mongoose');
const User = require('../models/User');

module.exports = function(db, upload) {
  // Get all items (feed)
  router.get('/', async (req, res) => {
    try {
      // Get filter parameters from query string
      const { type, category, country, state, city, location, date, keyword, seeded } = req.query;
      
      console.log('Filter parameters:', req.query); // Debug log
      
      // If using MongoDB
      if (USE_MONGODB) {
        try {
          // Build MongoDB filter
          const filter = {};
          if (type) filter.type = type;
          if (category) filter.category = category;
          if (country) filter.country = country;
          if (state) filter.state = state;
          if (city) filter.city = city;
          if (location) filter.location = new RegExp(location, 'i');
          if (date) filter.date = date;
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
                type: 'Lost',
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
                type: 'Found',
                createdAt: moment().subtract(3, 'hours').toDate()
              }).save();
              
              // Fetch items again
              const seededItems = await Item.find().sort({ createdAt: -1 });
              
              return res.render('items/index', {
                items: seededItems,
                type, category, country, state, city, location, date, keyword,
                moment,
                message: 'Welcome! We\'ve added some sample items to get you started.'
              });
            }
          }
          
          res.render('items/index', {
            items,
            type, category, country, state, city, location, date, keyword,
            moment,
            message: seeded === 'true' ? 'Test items added successfully!' : null
          });
        } catch (mongoErr) {
          console.error('MongoDB query error:', mongoErr);
          
          // Fallback to SQLite
          console.log('Falling back to SQLite due to MongoDB error');
          useSQLite();
        }
      } else {
        // Use SQLite (original implementation)
        useSQLite();
      }
      
      // SQLite implementation (extracted to a function for fallback)
      async function useSQLite() {
        // Start with base query and empty where clause
        let baseQuery = 'SELECT * FROM items';
        let whereConditions = [];
        let params = [];
        
        // Add filter conditions if they exist
        if (type) {
          whereConditions.push('type = ?');
          params.push(type);
        }
        
        if (category) {
          whereConditions.push('category = ?');
          params.push(category);
        }
        
        if (country) {
          whereConditions.push('country = ?');
          params.push(country);
        }
        
        if (state) {
          whereConditions.push('state = ?');
          params.push(state);
        }
        
        if (city) {
          whereConditions.push('city = ?');
          params.push(city);
        }
        
        if (location) {
          whereConditions.push('location LIKE ?');
          params.push(`%${location}%`);
        }
        
        if (date) {
          whereConditions.push('date = ?');
          params.push(date);
        }
        
        if (keyword) {
          whereConditions.push('(title LIKE ? OR description LIKE ?)');
          params.push(`%${keyword}%`, `%${keyword}%`);
        }
        
        // Construct final query with WHERE clause only if conditions exist
        let finalQuery = baseQuery;
        if (whereConditions.length > 0) {
          finalQuery += ' WHERE ' + whereConditions.join(' AND ');
        }
        
        // Add ordering to show most recent items first
        finalQuery += ' ORDER BY created_at DESC';
        
        console.log('Final SQL Query:', finalQuery); // Debug log
        console.log('Parameters:', params); // Debug log
        
        // Execute the query with parameters
        try {
          // Convert callback-based db.all to a Promise
          const items = await new Promise((resolve, reject) => {
            db.all(finalQuery, params, (err, rows) => {
              if (err) reject(err);
              else resolve(rows || []);
            });
          });
          
          console.log(`Found ${items.length} items in SQLite`);
          
          if (items.length > 0) {
            // Format timestamps for display
            const formattedItems = formatItemDates(items);
            
            res.render('items/index', { 
              items: formattedItems,
              type, category, country, state, city, location, date, keyword,
              moment,
              message: seeded === 'true' ? 'Test items added successfully!' : null
            });
          } else {
            // If empty results and no filters, check if we need to seed data
            if (Object.keys(req.query).length === 0) {
              // ... (your existing SQLite seeding code) ...
              // Keep this part as it is in your original file
            }
            
            // Normal empty response
            res.render('items/index', { 
              items: [],
              type, category, country, state, city, location, date, keyword,
              moment
            });
          }
        } catch (dbError) {
          console.error('Database query error:', dbError);
          res.render('items/index', { 
            items: [],
            type, category, country, state, city, location, date, keyword,
            moment,
            error: 'Failed to retrieve items. Please try again later.'
          });
        }
      }
    } catch (error) {
      console.error('Error in items index route:', error);
      res.status(500).send('Server error: ' + error.message);
    }
  });

  // Display form to create a new item
  router.get('/new', (req, res) => {
    res.render('items/new', { req });
  });

  // Create a new item
  router.post('/', upload.array('images', 2), async (req, res) => {
    try {
      const { 
        title, description, category, location, 
        countryName, stateName, cityName, locality,
        date, contact, type 
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
      
      let itemId;
      
      // If using MongoDB
      if (USE_MONGODB) {
        try {
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
            type,
            image1,
            image2,
            createdAt: new Date()
          });
          
          const savedItem = await newItem.save();
          itemId = savedItem._id;
        } catch (mongoErr) {
          console.error('Error saving to MongoDB:', mongoErr);
          
          // Fallback to SQLite if MongoDB fails
          itemId = await saveSQLite();
        }
      } else {
        // Use SQLite directly
        itemId = await saveSQLite();
      }
      
      // SQLite save function
      async function saveSQLite() {
        return new Promise((resolve, reject) => {
          const query = `INSERT INTO items (
            title, description, category, location, 
            country, state, city, locality,
            date, contact, type, image1, image2
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
          
          db.run(
            query, 
            [
              title, description, category, formattedLocation,
              country, state, city, locality || null,
              date, contact, type, image1, image2
            ], 
            function(err) {
              if (err) {
                console.error('SQLite error:', err);
                reject(err);
              } else {
                resolve(this.lastID);
              }
            }
          );
        });
      }
      
      res.redirect(`/items/${itemId}`);
    } catch (error) {
      console.error('Error creating item:', error);
      res.status(500).send('Server error: ' + error.message);
    }
  });

  // Show item details
  router.get('/:id', async (req, res) => {
    try {
      const id = req.params.id;
      let item, matches;
      
      // If using MongoDB
      if (USE_MONGODB) {
        try {
          // Try to find by MongoDB ObjectId
          item = await Item.findById(id);
          
          // If not found by ObjectId, try to find by SQLite ID during transition
          if (!item && !id.match(/^[0-9a-fA-F]{24}$/)) {
            item = await Item.findOne({ sqliteId: parseInt(id) });
          }
          
          if (!item) {
            return res.status(404).render('error', {
              message: 'Item not found',
              error: { status: 404, message: 'The requested item does not exist or has been removed.' }
            });
          }
          
          // Find possible matches
          const matchType = item.type === 'Lost' ? 'Found' : 'Lost';
          matches = await Item.find({ 
            type: matchType, 
            category: item.category,
            _id: { $ne: item._id }
          })
          .sort({ date: -1 })
          .limit(3);
        } catch (mongoErr) {
          console.error('MongoDB error:', mongoErr);
          
          // Fallback to SQLite
          [item, matches] = await getSQLiteItemAndMatches();
        }
      } else {
        // Use SQLite directly
        [item, matches] = await getSQLiteItemAndMatches();
      }
      
      // SQLite implementation
      async function getSQLiteItemAndMatches() {
        // Get the requested item
        const sqlItem = await new Promise((resolve, reject) => {
          db.get('SELECT *, datetime(created_at) as created_at FROM items WHERE id = ?', [id], (err, row) => {
            if (err) reject(err);
            else resolve(row);
          });
        });
        
        if (!sqlItem) {
          return [null, []];
        }
        
        // Format timestamps
        const formattedItem = formatItemDates(sqlItem);
        
        // Find matches
        const matchType = sqlItem.type === 'Lost' ? 'Found' : 'Lost';
        const sqlMatches = await new Promise((resolve, reject) => {
          const matchQuery = `SELECT *, datetime(created_at) as created_at FROM items 
                             WHERE type = ? AND category = ? AND id != ?
                             ORDER BY date DESC LIMIT 3`;
          
          db.all(matchQuery, [matchType, sqlItem.category, id], (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
          });
        });
        
        // Format match timestamps
        const formattedMatches = formatItemDates(sqlMatches);
        
        return [formattedItem, formattedMatches];
      }
      
      // If no item was found in either database
      if (!item) {
        return res.status(404).render('error', {
          message: 'Item not found',
          error: { status: 404, message: 'The requested item does not exist or has been removed.' }
        });
      }
      
      res.render('items/show', {
        item,
        matches,
        moment
      });
    } catch (error) {
      console.error('Error in item details route:', error);
      res.status(500).send('Server error: ' + error.message);
    }
  });

  // Rest of your routes...
  // Update these in a similar fashion to handle both databases
  // I'll show a skeleton for a couple more important routes

  // Edit item form
  router.get('/:id/edit', async (req, res) => {
    try {
      const id = req.params.id;
      let item;
      
      // Based on database flag, fetch from MongoDB or SQLite
      if (USE_MONGODB) {
        // MongoDB logic
        try {
          item = await Item.findById(id);
          if (!item && !id.match(/^[0-9a-fA-F]{24}$/)) {
            item = await Item.findOne({ sqliteId: parseInt(id) });
          }
        } catch (mongoErr) {
          console.error('MongoDB error:', mongoErr);
          item = await getSQLiteItem();
        }
      } else {
        // SQLite logic
        item = await getSQLiteItem();
      }
      
      async function getSQLiteItem() {
        return new Promise((resolve, reject) => {
          db.get('SELECT * FROM items WHERE id = ?', [id], (err, row) => {
            if (err) reject(err);
            else resolve(row);
          });
        });
      }
      
      if (!item) {
        return res.status(404).render('error', {
          message: 'Item not found',
          error: { status: 404, message: 'The requested item does not exist or has been removed.' }
        });
      }
      
      res.render('items/edit', { item });
    } catch (error) {
      console.error('Error in edit item route:', error);
      res.status(500).send('Server error: ' + error.message);
    }
  });

  // Continue updating the remaining routes in a similar fashion
  // Each route should check the USE_MONGODB flag and have logic for both databases
  // Include error handling and fallbacks

  return router;
};