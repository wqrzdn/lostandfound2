const express = require('express');
const router = express.Router();
const path = require('path');
const moment = require('moment');
const fs = require('fs');

// Helper function to ensure proper timestamp processing
function formatItemDates(items) {
  if (!Array.isArray(items)) {
    // Single item
    if (items && items.created_at) {
      // Ensure created_at is properly formatted for moment
      if (typeof items.created_at === 'string') {
        // If it's an ISO timestamp or similar, this will parse correctly
        items.created_at = moment(items.created_at).isValid() 
          ? items.created_at 
          : moment().subtract(1, 'minutes').toISOString(); // Default to recent if invalid
      } else {
        // If it's a number, treat as Unix timestamp (seconds from epoch)
        items.created_at = moment.unix(items.created_at).toISOString();
      }
    }
    return items;
  }
  
  // Array of items
  return items.map(item => {
    if (item.created_at) {
      // Ensure created_at is properly formatted for moment
      if (typeof item.created_at === 'string') {
        // If it's an ISO timestamp or similar, this will parse correctly
        item.created_at = moment(item.created_at).isValid() 
          ? item.created_at 
          : moment().subtract(1, 'minutes').toISOString(); // Default to recent if invalid
      } else {
        // If it's a number, treat as Unix timestamp (seconds from epoch)
        item.created_at = moment.unix(item.created_at).toISOString();
      }
    }
    return item;
  });
}

module.exports = function(db, upload) {
  // Get all items (feed)
  router.get('/', async (req, res) => {
    try {
      // Get filter parameters from query string
      const { type, category, country, state, city, location, date, keyword, seeded } = req.query;
      
      console.log('Filter parameters:', req.query); // Debug log
      
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
      
      // Execute the query with parameters - properly promisified
      try {
        // Convert callback-based db.all to a Promise
        const items = await new Promise((resolve, reject) => {
          db.all(finalQuery, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
          });
        });
        
        console.log(`Found ${items.length} items`); // Debug log
        
        if (items.length > 0) {
          console.log('First item preview:', JSON.stringify(items[0], null, 2));
          // Format timestamps for display
          const formattedItems = formatItemDates(items);
          
          res.render('items/index', { 
            items: formattedItems,
            type, 
            category, 
            country, 
            state, 
            city,
            location,
            date, 
            keyword,
            moment,
            message: seeded === 'true' ? 'Test items added successfully!' : null
          });
        } else {
          console.log('No items found in database, checking if we need to seed test data');
          
          // If there are no items in the database and no filters are applied, seed a test item
          if (Object.keys(req.query).length === 0) {
            try {
              const count = await new Promise((resolve, reject) => {
                db.get('SELECT COUNT(*) as count FROM items', [], (err, row) => {
                  if (err) reject(err);
                  else resolve(row?.count || 0);
                });
              });
              
              if (count === 0) {
                console.log('Database is empty, adding test items');
                // Add sample items
                await new Promise((resolve, reject) => {
                  const query = `INSERT INTO items (
                    title, description, category, location, 
                    country, state, city, date, contact, type, 
                    created_at
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '-1 day'))`;
                  
                  db.run(
                    query, 
                    [
                      'Lost Wallet', 'Black leather wallet with ID cards', 'Wallet', 'Downtown Area',
                      'United States', 'California', 'Los Angeles', '2023-05-15', 'contact@example.com', 'Lost'
                    ], 
                    function(err) {
                      if (err) reject(err);
                      else resolve(this.lastID);
                    }
                  );
                });
                
                await new Promise((resolve, reject) => {
                  const query = `INSERT INTO items (
                    title, description, category, location, 
                    country, state, city, date, contact, type, 
                    created_at
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '-3 hours'))`;
                  
                  db.run(
                    query, 
                    [
                      'Found Keys', 'Set of keys with a blue keychain', 'Keys', 'Central Park',
                      'United States', 'New York', 'New York City', '2023-04-20', 'finder@example.com', 'Found'
                    ], 
                    function(err) {
                      if (err) reject(err);
                      else resolve(this.lastID);
                    }
                  );
                });
                
                // Fetch items again after adding test items
                const seededItems = await new Promise((resolve, reject) => {
                  db.all('SELECT * FROM items ORDER BY created_at DESC', [], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                  });
                });
                
                console.log(`After seeding, found ${seededItems.length} items`);
                
                // Format timestamps
                const formattedItems = formatItemDates(seededItems);
                
                res.render('items/index', { 
                  items: formattedItems,
                  type, 
                  category, 
                  country, 
                  state, 
                  city,
                  location,
                  date, 
                  keyword,
                  moment,
                  message: 'Welcome! We\'ve added some sample items to get you started.'
                });
                return;
              }
            } catch (seedError) {
              console.error('Error seeding test data:', seedError);
            }
          }
          
          // Normal empty response
          res.render('items/index', { 
            items: [],
            type, 
            category, 
            country, 
            state, 
            city,
            location,
            date, 
            keyword,
            moment
          });
        }
      } catch (dbError) {
        console.error('Database query error:', dbError);
        res.render('items/index', { 
          items: [],
          type, 
          category, 
          country, 
          state, 
          city,
          location,
          date, 
          keyword,
          moment,
          error: 'Failed to retrieve items. Please try again later.'
        });
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
  router.post('/', upload.array('images', 2), (req, res) => {
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
    
    // Insert into database
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
          console.error(err);
          return res.status(500).send('Database error');
        }
        
        res.redirect(`/items/${this.lastID}`);
      }
    );
  });

  // Show item details
  router.get('/:id', async (req, res) => {
    try {
      const id = req.params.id;
      
      // Get the requested item with proper date format
      const item = await new Promise((resolve, reject) => {
        db.get('SELECT *, datetime(created_at) as created_at FROM items WHERE id = ?', [id], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });
      
      if (!item) {
        return res.status(404).render('error', { 
          message: 'Item not found',
          error: { status: 404, message: 'The requested item does not exist or has been removed.' }
        });
      }
      
      // Format item timestamps
      const formattedItem = formatItemDates(item);
      
      // Find possible matches (if it's a lost item, find similar found items and vice versa)
      const matchType = item.type === 'Lost' ? 'Found' : 'Lost';
      
      const matches = await new Promise((resolve, reject) => {
        const matchQuery = `SELECT *, datetime(created_at) as created_at FROM items 
                           WHERE type = ? AND category = ? AND id != ?
                           ORDER BY date DESC LIMIT 3`;
        
        db.all(matchQuery, [matchType, item.category, id], (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        });
      });
      
      // Format match timestamps
      const formattedMatches = formatItemDates(matches);
      
      res.render('items/show', { 
        item: formattedItem, 
        matches: formattedMatches,
        moment
      });
    } catch (error) {
      console.error('Error showing item details:', error);
      res.status(500).render('error', {
        message: 'Failed to load item details',
        error: { message: error.message }
      });
    }
  });

  // Display edit form
  router.get('/:id/edit', async (req, res) => {
    try {
      const id = req.params.id;
      
      const item = await new Promise((resolve, reject) => {
        db.get('SELECT * FROM items WHERE id = ?', [id], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });
      
      if (!item) {
        return res.status(404).render('error', {
          message: 'Item not found',
          error: { status: 404 }
        });
      }
      
      res.render('items/edit', { item });
    } catch (error) {
      console.error('Error loading edit form:', error);
      res.status(500).render('error', {
        message: 'Failed to load edit form',
        error: { message: error.message }
      });
    }
  });

  // Update item
  router.put('/:id', upload.array('images', 2), (req, res) => {
    const id = req.params.id;
    const { 
      title, description, category, location,
      countryName, stateName, cityName, locality,
      date, contact, type 
    } = req.body;
    
    // Use the name values instead of codes
    const country = countryName || req.body.country;
    const state = stateName || req.body.state;
    const city = cityName || req.body.city;
    
    // Get current item to check for existing images
    db.get('SELECT image1, image2 FROM items WHERE id = ?', [id], (err, item) => {
      if (err) {
        console.error(err);
        return res.status(500).send('Database error');
      }
      
      if (!item) {
        return res.status(404).send('Item not found');
      }
      
      // Determine image paths (keep existing if no new uploads)
      let image1 = item.image1;
      let image2 = item.image2;
      
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
      
      // Update database
      const query = `UPDATE items 
                     SET title = ?, description = ?, category = ?, location = ?, 
                     country = ?, state = ?, city = ?, locality = ?,
                     date = ?, contact = ?, type = ?, image1 = ?, image2 = ?
                     WHERE id = ?`;
      
      db.run(
        query, 
        [
          title, description, category, formattedLocation,
          country, state, city, locality || null,
          date, contact, type, image1, image2,
          id
        ], 
        function(err) {
          if (err) {
            console.error(err);
            return res.status(500).send('Database error');
          }
          
          res.redirect(`/items/${id}`);
        }
      );
    });
  });

  // Delete item
  router.delete('/:id', async (req, res) => {
    try {
      const id = req.params.id;
      
      // Get item to get image paths before deleting
      const item = await new Promise((resolve, reject) => {
        db.get('SELECT image1, image2 FROM items WHERE id = ?', [id], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });
      
      if (!item) {
        return res.status(404).render('error', {
          message: 'Item not found',
          error: { status: 404 }
        });
      }
      
      // Delete the database record
      await new Promise((resolve, reject) => {
        db.run('DELETE FROM items WHERE id = ?', [id], function(err) {
          if (err) reject(err);
          else resolve(this.changes);
        });
      });
      
      // Attempt to delete image files (if they exist)
      try {
        if (item.image1) {
          const imagePath = path.join(__dirname, '../public', item.image1);
          if (fs.existsSync(imagePath)) {
            fs.unlinkSync(imagePath);
          }
        }
        if (item.image2) {
          const imagePath = path.join(__dirname, '../public', item.image2);
          if (fs.existsSync(imagePath)) {
            fs.unlinkSync(imagePath);
          }
        }
      } catch (e) {
        console.log('Error deleting image files:', e);
        // Continue even if image deletion fails
      }
      
      res.redirect('/items');
    } catch (error) {
      console.error('Error deleting item:', error);
      res.status(500).render('error', {
        message: 'Failed to delete item',
        error: { message: error.message }
      });
    }
  });

  // Admin route for managing items
  router.get('/admin/dashboard', (req, res) => {
    db.all('SELECT * FROM items ORDER BY created_at DESC', [], (err, items) => {
      if (err) {
        console.error(err);
        return res.status(500).send('Database error');
      }
      
      res.render('admin/dashboard', { items, moment });
    });
  });

  // Helper route to seed a test item (for development only)
  router.get('/seed-test-item', async (req, res) => {
    try {
      // Check if items already exist
      const count = await new Promise((resolve, reject) => {
        db.get('SELECT COUNT(*) as count FROM items', [], (err, row) => {
          if (err) reject(err);
          else resolve(row?.count || 0);
        });
      });
      
      // Add a sample item - lost wallet
      await new Promise((resolve, reject) => {
        const query = `INSERT INTO items (
          title, description, category, location, 
          country, state, city, date, contact, type, 
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '-1 day'))`;
        
        db.run(
          query, 
          [
            'Lost Wallet', 'Black leather wallet with ID cards', 'Wallet', 'Downtown Area',
            'United States', 'California', 'Los Angeles', '2023-05-15', 'contact@example.com', 'Lost'
          ], 
          function(err) {
            if (err) reject(err);
            else resolve(this.lastID);
          }
        );
      });
      
      // Add another sample item - found keys
      await new Promise((resolve, reject) => {
        const query = `INSERT INTO items (
          title, description, category, location, 
          country, state, city, date, contact, type, 
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '-3 hours'))`;
        
        db.run(
          query, 
          [
            'Found Keys', 'Set of keys with a blue keychain', 'Keys', 'Central Park',
            'United States', 'New York', 'New York City', '2023-04-20', 'finder@example.com', 'Found'
          ], 
          function(err) {
            if (err) reject(err);
            else resolve(this.lastID);
          }
        );
      });
      
      // Add another sample item - lost phone (more recent)
      await new Promise((resolve, reject) => {
        const query = `INSERT INTO items (
          title, description, category, location, 
          country, state, city, date, contact, type, 
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '-30 minutes'))`;
        
        db.run(
          query, 
          [
            'Lost iPhone', 'Black iPhone 13 with red case', 'Phone', 'Coffee Shop',
            'United States', 'Washington', 'Seattle', '2023-06-10', 'phone_owner@example.com', 'Lost'
          ], 
          function(err) {
            if (err) reject(err);
            else resolve(this.lastID);
          }
        );
      });
      
      // Add found bag
      await new Promise((resolve, reject) => {
        const query = `INSERT INTO items (
          title, description, category, location, 
          country, state, city, date, contact, type, 
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '-5 hours'))`;
        
        db.run(
          query, 
          [
            'Found Backpack', 'Black backpack with laptop inside', 'Bag', 'University Library',
            'United Kingdom', 'England', 'London', '2023-06-12', 'library@example.com', 'Found'
          ], 
          function(err) {
            if (err) reject(err);
            else resolve(this.lastID);
          }
        );
      });
      
      // Redirect to items with a success message using a query parameter
      res.redirect('/items?seeded=true');
    } catch (error) {
      console.error('Error creating test items:', error);
      res.status(500).render('error', {
        message: 'Error creating test items',
        error: { message: error.message }
      });
    }
  });

  // Diagnostic route to check database
  router.get('/check-db', async (req, res) => {
    try {
      const items = await db.all('SELECT * FROM items ORDER BY created_at DESC');
      const tableInfo = await db.all('PRAGMA table_info(items)');
      
      res.send(`
        <h3>Database Diagnostic</h3>
        <h4>Table Schema:</h4>
        <pre>${JSON.stringify(tableInfo, null, 2)}</pre>
        <h4>Items (${items.length}):</h4>
        <pre>${JSON.stringify(items, null, 2)}</pre>
        <p><a href="/items" class="btn btn-primary">Return to Items</a></p>
      `);
    } catch (error) {
      res.status(500).send('Database error: ' + error.message);
    }
  });

  return router;
}; 