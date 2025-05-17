/**
 * Public routes for browsing lost and found items without authentication
 */

const express = require('express');
const router = express.Router();
const Item = require('../models/Item');

// Public browse page - accessible without login
router.get('/browse', async (req, res) => {
  try {
    console.log('Public browsing of items accessed');
    
    // Extract query parameters for filtering
    const { type, category, location, page = 1 } = req.query;
    const query = {};
    
    // Build query based on filters
    if (type && ['lost', 'found'].includes(type)) {
      query.type = type;
    }
    
    if (category) {
      query.category = category;
    }
    
    if (location) {
      // Use regex for partial location matching
      query.location = { $regex: location, $options: 'i' };
    }
    
    // Only show active items to the public
    query.status = 'active';
    
    // Set up pagination
    const limit = 9; // Items per page
    const skip = (page - 1) * limit;
    
    // Get total count for pagination
    const totalItems = await Item.countDocuments(query);
    const totalPages = Math.ceil(totalItems / limit);
    
    // Get items with pagination and sorting
    const items = await Item.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(); // Use lean for better performance
    
    // Log for monitoring
    console.log(`Found ${items.length} public items matching query:`, query);
    
    // Render the public browse page
    res.render('public/browse', {
      items,
      query: req.query,
      currentPage: parseInt(page),
      totalPages,
      totalItems
    });
  } catch (error) {
    console.error('Error in public browse route:', error);
    res.status(500).render('error', {
      message: 'Error loading items',
      error: process.env.NODE_ENV === 'development' ? error : {}
    });
  }
});

// Public item details page - accessible without login
router.get('/item/:id', async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);
    
    if (!item || item.status !== 'active') {
      return res.status(404).render('error', {
        message: 'Item not found',
        error: { status: 404 }
      });
    }
    
    // Render item details without contact information
    // Contact info is only available after login
    res.render('public/item', { item });
  } catch (error) {
    console.error('Error loading public item details:', error);
    res.status(500).render('error', {
      message: 'Error loading item details',
      error: process.env.NODE_ENV === 'development' ? error : {}
    });
  }
});

module.exports = router;
