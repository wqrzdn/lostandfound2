const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const multer = require('multer');
const methodOverride = require('method-override');
const fs = require('fs');
const ejsLayouts = require('express-ejs-layouts');
const fetch = require('node-fetch');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const session = require('express-session');
const passport = require('passport');

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Database Connection
const connectDB = require('./config/database');

// Import MongoDB models
const Item = require('./models/Item'); // Make sure this path is correct

// Location API Configuration
const COUNTRIES_API_URL = 'https://restcountries.com/v3.1/all?fields=name,cca2';
const GEODB_API_URL = 'https://wft-geo-db.p.rapidapi.com/v1/geo';
const GEODB_API_KEY = '1e4a2a0565msh142fce6849f1721p18d732jsn9546aa1cc974'; // Replace with your RapidAPI key

// API Cache to reduce requests to external APIs
const apiCache = {
  countries: null,
  countriesLastFetched: null,
  states: {},
  cities: {},
  cacheExpiryMs: 24 * 60 * 60 * 1000 // 24 hours
};

// Common states/provinces data for fallback
const commonStatesData = {
  // Keep your existing commonStatesData object here
  'US': [
    // US states data...
  ],
  'IN': [
    // India states data...
  ],
  // Other countries...
};

// Set up EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('layout', 'layout'); // Set default layout
app.use(ejsLayouts);

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, 'public')));

// Set up multer for file uploads
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, 'public/uploads/');
  },
  filename: function(req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5000000 }, // 5MB limit
  fileFilter: function(req, file, cb) {
    checkFileType(file, cb);
  }
});

// Check file type
function checkFileType(file, cb) {
  // Allowed extensions
  const filetypes = /jpeg|jpg|png|gif/;
  // Check extension
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  // Check mime type
  const mimetype = filetypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb('Error: Images only!');
  }
}

// Create uploads directory if it doesn't exist
if (!fs.existsSync('./public/uploads')) {
  fs.mkdirSync('./public/uploads', { recursive: true });
}

// Create uploads directory if it doesn't exist
if (!fs.existsSync('./public/uploads')) {
  fs.mkdirSync('./public/uploads', { recursive: true });
}

// Connect to MongoDB
connectDB().catch(err => {
  console.error('Failed to connect to MongoDB:', err);
  process.exit(1);
});

// Initialize Passport
require('./config/passport');

// Express Session middleware
app.use(session({
  secret: process.env.JWT_SECRET || 'secret',
  resave: false,
  saveUninitialized: true,
  cookie: { 
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 1 day
  }
}));

// Initialize Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Cookie parser middleware
const cookieParser = require('cookie-parser');
app.use(cookieParser());

// Flash messages middleware
const flash = require('connect-flash');
app.use(flash());

// Method override middleware to support PUT/DELETE in forms
app.use(methodOverride('_method'));

// Authentication middleware - Sets req.user if authenticated
const authMiddleware = require('./middleware/auth');
app.use(authMiddleware);

// Google authentication handler middleware
const googleAuthHandler = require('./middleware/googleAuthHandler');
app.use(googleAuthHandler);

// Require authentication middleware for protected routes
const requireAuth = require('./middleware/requireAuth');

// Global Variables for flash messages and user object
app.use((req, res, next) => {
  // Flash messages
  res.locals.success_msg = req.flash('success');
  res.locals.error_msg = req.flash('error');
  res.locals.info_msg = req.flash('info');
  
  // Pass user object to all views
  // For Passport authentication, req.user will be set by Passport
  res.locals.user = req.user || res.locals.user;
  
  next();
});

// Routes
app.get('/', requireAuth, (req, res) => {
  // Now we can be sure the user is authenticated due to requireAuth middleware
  console.log('Home page accessed by:', req.user.email);
  
  if (req.user.role === 'admin') {
    // Admins should be directed to admin dashboard
    return res.redirect('/admin/dashboard');
  }
  
  // Regular users see the homepage
  res.render('index', { user: req.user });
});

// User Dashboard
app.get('/dashboard', requireAuth, async (req, res) => {
  try {
    // Only for regular users
    if (req.user.role === 'admin') {
      return res.redirect('/admin/dashboard');
    }
    
    // Get user's items
    const userItems = await Item.find({ user: req.user._id })
      .sort({ createdAt: 'desc' })
      .exec();
      
    // Filter items by type and status
    const userLostItems = userItems.filter(item => item.type === 'lost');
    const userFoundItems = userItems.filter(item => item.type === 'found');
    const userResolvedItems = userItems.filter(item => item.status === 'resolved');
    
    // Find potential matches
    // For lost items, find similar found items and vice versa
    const potentialMatches = [];
    
    // Simplified match logic - find items with same category
    if (userLostItems.length > 0) {
      // For each lost item, find potential found matches
      for (const lostItem of userLostItems) {
        const foundMatches = await Item.find({
          type: 'found',
          category: lostItem.category,
          user: { $ne: req.user._id }, // Not the user's own items
          status: 'active'
        }).limit(2);
        
        potentialMatches.push(...foundMatches);
      }
    }
    
    if (userFoundItems.length > 0) {
      // For each found item, find potential lost matches
      for (const foundItem of userFoundItems) {
        const lostMatches = await Item.find({
          type: 'lost',
          category: foundItem.category,
          user: { $ne: req.user._id }, // Not the user's own items
          status: 'active'
        }).limit(2);
        
        potentialMatches.push(...lostMatches);
      }
    }
    
    // Remove duplicates from potential matches
    const uniqueMatches = [];
    const matchIds = new Set();
    
    for (const match of potentialMatches) {
      if (!matchIds.has(match._id.toString())) {
        matchIds.add(match._id.toString());
        uniqueMatches.push(match);
      }
    }
    
    // Limit to 4 potential matches
    const limitedMatches = uniqueMatches.slice(0, 4);
    
    // Generate recent activity (simplified for now)
    const recentActivity = [];
    
    // Render the dashboard
    res.render('dashboard', {
      user: req.user,
      userItems,
      userLostItems,
      userFoundItems,
      userResolvedItems,
      potentialMatches: limitedMatches,
      recentActivity
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).render('error', {
      message: 'Error loading dashboard',
      error: err
    });
  }
});

// Location data endpoints
app.get('/api/countries', async (req, res) => {
  try {
    // Check cache first
    if (apiCache.countries && apiCache.countriesLastFetched && 
        (Date.now() - apiCache.countriesLastFetched) < apiCache.cacheExpiryMs) {
      return res.json(apiCache.countries);
    }
    
    // Fetch from API
    const response = await fetch(COUNTRIES_API_URL);
    const data = await response.json();
    
    // Format data
    const countries = data.map(country => ({
      code: country.cca2,
      name: country.name.common
    })).sort((a, b) => a.name.localeCompare(b.name));
    
    // Update cache
    apiCache.countries = countries;
    apiCache.countriesLastFetched = Date.now();
    
    res.json(countries);
  } catch (error) {
    console.error('Error fetching countries:', error);
    res.status(500).json({ error: 'Failed to fetch countries' });
  }
});

app.get('/api/states/:countryCode', async (req, res) => {
  try {
    const countryCode = req.params.countryCode.toUpperCase();
    
    // Check cache first
    if (apiCache.states[countryCode] && 
        (Date.now() - apiCache.states[countryCode].lastFetched) < apiCache.cacheExpiryMs) {
      return res.json(apiCache.states[countryCode].data);
    }
    
    // Check if we have fallback data for this country
    if (commonStatesData[countryCode]) {
      // Update cache
      apiCache.states[countryCode] = {
        data: commonStatesData[countryCode],
        lastFetched: Date.now()
      };
      
      return res.json(commonStatesData[countryCode]);
    }
    
    // Fallback to empty array if no data available
    apiCache.states[countryCode] = {
      data: [],
      lastFetched: Date.now()
    };
    
    res.json([]);
  } catch (error) {
    console.error(`Error fetching states for ${req.params.countryCode}:`, error);
    res.status(500).json({ error: 'Failed to fetch states' });
  }
});

app.get('/api/cities/:countryCode/:stateCode', async (req, res) => {
  try {
    const { countryCode, stateCode } = req.params;
    const cacheKey = `${countryCode}-${stateCode}`;
    
    // Check cache first
    if (apiCache.cities[cacheKey] && 
        (Date.now() - apiCache.cities[cacheKey].lastFetched) < apiCache.cacheExpiryMs) {
      return res.json(apiCache.cities[cacheKey].data);
    }
    
    // For simplicity, return empty array
    // In a real app, you would call an actual API here
    apiCache.cities[cacheKey] = {
      data: [],
      lastFetched: Date.now()
    };
    
    res.json([]);
  } catch (error) {
    console.error(`Error fetching cities:`, error);
    res.status(500).json({ error: 'Failed to fetch cities' });
  }
});

// Load authentication middleware
const requireAdmin = require('./middleware/requireAdmin');
const redirectByRole = require('./middleware/redirectByRole');

// Routes configuration
const itemsRouter = require('./routes/items_new');  // Using our improved router
const authRouter = require('./routes/auth');
const adminRouter = require('./routes/admin');
const adminItemsRouter = require('./routes/admin_items'); // New dedicated admin item management

app.use('/auth', authRouter);
app.use('/items', itemsRouter(upload));
app.use('/admin', adminRouter);
app.use('/admin_items', adminItemsRouter); // New dedicated admin item management routes

// Set different layouts based on route
app.use((req, res, next) => {
  // Set admin layout for admin routes
  if (req.path.startsWith('/admin')) {
    app.set('layout', 'admin_layout');
    // Override the default render function to ensure admin layout is used
    const originalRender = res.render;
    res.render = function(view, options, callback) {
      options = options || {};
      // Force the admin layout for all admin views
      options.layout = 'admin_layout';
      originalRender.call(this, view, options, callback);
    };
  } else {
    // Use default layout for all other routes
    app.set('layout', 'layout_new');
  }
  next();
});

// Auth routes are always public - do not require auth
app.use('/auth', authRouter);

// Public routes for static files
app.use('/css', express.static(path.join(__dirname, 'public/css')));
app.use('/js', express.static(path.join(__dirname, 'public/js')));

// API routes (needed for filtering to work properly)
app.use('/api', (req, res, next) => {
  // Allow API access for authenticated users
  if (req.user) {
    next();
  } else {
    res.status(401).json({ error: 'Authentication required' });
  }
});

// Role-based redirection middleware
app.use(redirectByRole);

// ALL other routes require authentication
app.use('/', requireAuth);

// Items routes
app.use('/items', itemsRouter(upload));

// Admin routes - require admin role
app.use('/admin', requireAdmin, adminRouter);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render('error', {
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err : {}
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).render('error', {
    message: 'Page not found',
    error: { status: 404 }
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;