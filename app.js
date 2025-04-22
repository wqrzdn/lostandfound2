const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const multer = require('multer');
const methodOverride = require('method-override');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const ejsLayouts = require('express-ejs-layouts');
const fetch = require('node-fetch');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

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
  'US': [
    { name: 'Alabama', code: 'AL' },
    { name: 'Alaska', code: 'AK' },
    { name: 'Arizona', code: 'AZ' },
    { name: 'Arkansas', code: 'AR' },
    { name: 'California', code: 'CA' },
    { name: 'Colorado', code: 'CO' },
    { name: 'Connecticut', code: 'CT' },
    { name: 'Delaware', code: 'DE' },
    { name: 'Florida', code: 'FL' },
    { name: 'Georgia', code: 'GA' },
    { name: 'Hawaii', code: 'HI' },
    { name: 'Idaho', code: 'ID' },
    { name: 'Illinois', code: 'IL' },
    { name: 'Indiana', code: 'IN' },
    { name: 'Iowa', code: 'IA' },
    { name: 'Kansas', code: 'KS' },
    { name: 'Kentucky', code: 'KY' },
    { name: 'Louisiana', code: 'LA' },
    { name: 'Maine', code: 'ME' },
    { name: 'Maryland', code: 'MD' },
    { name: 'Massachusetts', code: 'MA' },
    { name: 'Michigan', code: 'MI' },
    { name: 'Minnesota', code: 'MN' },
    { name: 'Mississippi', code: 'MS' },
    { name: 'Missouri', code: 'MO' },
    { name: 'Montana', code: 'MT' },
    { name: 'Nebraska', code: 'NE' },
    { name: 'Nevada', code: 'NV' },
    { name: 'New Hampshire', code: 'NH' },
    { name: 'New Jersey', code: 'NJ' },
    { name: 'New Mexico', code: 'NM' },
    { name: 'New York', code: 'NY' },
    { name: 'North Carolina', code: 'NC' },
    { name: 'North Dakota', code: 'ND' },
    { name: 'Ohio', code: 'OH' },
    { name: 'Oklahoma', code: 'OK' },
    { name: 'Oregon', code: 'OR' },
    { name: 'Pennsylvania', code: 'PA' },
    { name: 'Rhode Island', code: 'RI' },
    { name: 'South Carolina', code: 'SC' },
    { name: 'South Dakota', code: 'SD' },
    { name: 'Tennessee', code: 'TN' },
    { name: 'Texas', code: 'TX' },
    { name: 'Utah', code: 'UT' },
    { name: 'Vermont', code: 'VT' },
    { name: 'Virginia', code: 'VA' },
    { name: 'Washington', code: 'WA' },
    { name: 'West Virginia', code: 'WV' },
    { name: 'Wisconsin', code: 'WI' },
    { name: 'Wyoming', code: 'WY' },
    { name: 'District of Columbia', code: 'DC' }
  ],
  'IN': [
    { name: 'Andhra Pradesh', code: 'AP' },
    { name: 'Arunachal Pradesh', code: 'AR' },
    { name: 'Assam', code: 'AS' },
    { name: 'Bihar', code: 'BR' },
    { name: 'Chhattisgarh', code: 'CG' },
    { name: 'Goa', code: 'GA' },
    { name: 'Gujarat', code: 'GJ' },
    { name: 'Haryana', code: 'HR' },
    { name: 'Himachal Pradesh', code: 'HP' },
    { name: 'Jharkhand', code: 'JH' },
    { name: 'Karnataka', code: 'KA' },
    { name: 'Kerala', code: 'KL' },
    { name: 'Madhya Pradesh', code: 'MP' },
    { name: 'Maharashtra', code: 'MH' },
    { name: 'Manipur', code: 'MN' },
    { name: 'Meghalaya', code: 'ML' },
    { name: 'Mizoram', code: 'MZ' },
    { name: 'Nagaland', code: 'NL' },
    { name: 'Odisha', code: 'OD' },
    { name: 'Punjab', code: 'PB' },
    { name: 'Rajasthan', code: 'RJ' },
    { name: 'Sikkim', code: 'SK' },
    { name: 'Tamil Nadu', code: 'TN' },
    { name: 'Telangana', code: 'TG' },
    { name: 'Tripura', code: 'TR' },
    { name: 'Uttar Pradesh', code: 'UP' },
    { name: 'Uttarakhand', code: 'UK' },
    { name: 'West Bengal', code: 'WB' },
    { name: 'Andaman and Nicobar Islands', code: 'AN' },
    { name: 'Chandigarh', code: 'CH' },
    { name: 'Dadra and Nagar Haveli and Daman and Diu', code: 'DH' },
    { name: 'Delhi', code: 'DL' },
    { name: 'Jammu and Kashmir', code: 'JK' },
    { name: 'Ladakh', code: 'LA' },
    { name: 'Lakshadweep', code: 'LD' },
    { name: 'Puducherry', code: 'PY' }
  ],
  'CA': [
    { name: 'Alberta', code: 'AB' },
    { name: 'British Columbia', code: 'BC' },
    { name: 'Manitoba', code: 'MB' },
    { name: 'New Brunswick', code: 'NB' },
    { name: 'Newfoundland and Labrador', code: 'NL' },
    { name: 'Northwest Territories', code: 'NT' },
    { name: 'Nova Scotia', code: 'NS' },
    { name: 'Nunavut', code: 'NU' },
    { name: 'Ontario', code: 'ON' },
    { name: 'Prince Edward Island', code: 'PE' },
    { name: 'Quebec', code: 'QC' },
    { name: 'Saskatchewan', code: 'SK' },
    { name: 'Yukon', code: 'YT' }
  ],
  'GB': [
    { name: 'England', code: 'ENG' },
    { name: 'Northern Ireland', code: 'NIR' },
    { name: 'Scotland', code: 'SCT' },
    { name: 'Wales', code: 'WLS' }
  ],
  'AU': [
    { name: 'Australian Capital Territory', code: 'ACT' },
    { name: 'New South Wales', code: 'NSW' },
    { name: 'Northern Territory', code: 'NT' },
    { name: 'Queensland', code: 'QLD' },
    { name: 'South Australia', code: 'SA' },
    { name: 'Tasmania', code: 'TAS' },
    { name: 'Victoria', code: 'VIC' },
    { name: 'Western Australia', code: 'WA' }
  ]
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

// Create database directory if it doesn't exist
if (!fs.existsSync('./database')) {
  fs.mkdirSync('./database');
}

// Initialize database
const db = new sqlite3.Database('./database/lost_and_found.db', (err) => {
  if (err) {
    console.error('Error opening database', err);
  } else {
    console.log('Connected to the SQLite database.');
    // Create tables if they don't exist
    db.run(`CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      category TEXT NOT NULL,
      location TEXT NOT NULL,
      country TEXT,
      state TEXT,
      city TEXT,
      locality TEXT,
      date TEXT NOT NULL,
      contact TEXT NOT NULL,
      type TEXT NOT NULL,
      image1 TEXT,
      image2 TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
      if (err) {
        console.error('Error creating items table', err);
      } else {
        console.log('Items table created or already exists.');
        
        // Add new columns to existing table if they don't exist
        // Use a direct query without the callback to check if columns exist
        db.all(`PRAGMA table_info(items)`, [], (err, rows) => {
          if (err) {
            console.error('Error checking table schema', err);
            return;
          }
          
          // Check if location columns exist
          if (rows && Array.isArray(rows)) {
            const columnNames = rows.map(row => row.name);
            const hasCountry = columnNames.includes('country');
            const hasState = columnNames.includes('state');
            const hasCity = columnNames.includes('city');
            const hasLocality = columnNames.includes('locality');
            
            // Add missing columns if needed
            const columnsToAdd = [];
            if (!hasCountry) columnsToAdd.push(`ALTER TABLE items ADD COLUMN country TEXT`);
            if (!hasState) columnsToAdd.push(`ALTER TABLE items ADD COLUMN state TEXT`);
            if (!hasCity) columnsToAdd.push(`ALTER TABLE items ADD COLUMN city TEXT`);
            if (!hasLocality) columnsToAdd.push(`ALTER TABLE items ADD COLUMN locality TEXT`);
            
            if (columnsToAdd.length > 0) {
              console.log('Adding missing location columns to items table...');
              db.serialize(() => {
                columnsToAdd.forEach(query => {
                  db.run(query, err => {
                    if (err) console.error('Error adding column:', err);
                  });
                });
                console.log('Location columns added successfully.');
              });
            } else {
              console.log('All required columns already exist in the items table.');
            }
          } else {
            console.error('Invalid response from PRAGMA table_info');
          }
        });
      }
    });
  }
});

// Routes
app.get('/', (req, res) => {
  res.render('index');
});

// Location data endpoints
app.get('/api/countries', async (req, res) => {
  try {
    // Check if we have cached data that's still valid
    if (apiCache.countries && 
        apiCache.countriesLastFetched && 
        (Date.now() - apiCache.countriesLastFetched) < apiCache.cacheExpiryMs) {
      return res.json(apiCache.countries);
    }
    
    // Fetch countries from REST Countries API
    const response = await fetch(COUNTRIES_API_URL);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch countries: ${response.status}`);
    }
    
    const countriesData = await response.json();
    
    // Format countries data
    const countries = countriesData
      .sort((a, b) => a.name.common.localeCompare(b.name.common))
      .map(country => ({
        name: country.name.common,
        code: country.cca2
      }));
    
    // Update cache
    apiCache.countries = countries;
    apiCache.countriesLastFetched = Date.now();
    
    res.json(countries);
  } catch (error) {
    console.error('Error fetching countries:', error);
    
    // Return cached data if available, even if expired
    if (apiCache.countries) {
      res.json(apiCache.countries);
    } else {
      // Fallback to a limited set as last resort
      res.json([
        { name: 'United States', code: 'US' },
        { name: 'India', code: 'IN' },
        { name: 'United Kingdom', code: 'GB' },
        { name: 'Canada', code: 'CA' },
        { name: 'Australia', code: 'AU' }
      ]);
    }
  }
});

app.get('/api/states/:countryCode', async (req, res) => {
  const { countryCode } = req.params;
  
  try {
    // Check if we have cached data
    if (apiCache.states[countryCode] && 
        apiCache.states[countryCode].lastFetched && 
        (Date.now() - apiCache.states[countryCode].lastFetched) < apiCache.cacheExpiryMs) {
      return res.json(apiCache.states[countryCode].data);
    }
    
    // Check if we have a common fallback data for this country
    if (commonStatesData[countryCode]) {
      console.log(`Using fallback data for states in ${countryCode}`);
      
      // Update cache with the fallback data
      apiCache.states[countryCode] = {
        data: commonStatesData[countryCode],
        lastFetched: Date.now()
      };
      
      return res.json(commonStatesData[countryCode]);
    }
    
    // Try to fetch from GeoDB API
    try {
      // Fetch states (administrative divisions) from GeoDB API
      const response = await fetch(
        `${GEODB_API_URL}/countries/${countryCode}/regions?limit=50`,
        {
          headers: {
            'X-RapidAPI-Key': GEODB_API_KEY,
            'X-RapidAPI-Host': 'wft-geo-db.p.rapidapi.com'
          }
        }
      );
      
      if (!response.ok) {
        throw new Error(`Failed to fetch states: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Format states data
      const states = data.data
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(state => ({
          name: state.name,
          code: state.isoCode || state.wikiDataId
        }));
      
      // Update cache
      apiCache.states[countryCode] = {
        data: states,
        lastFetched: Date.now()
      };
      
      return res.json(states);
    } catch (apiError) {
      console.error(`Error fetching states for ${countryCode} from API:`, apiError);
      
      // Fall back to REST Countries API to get country info
      const countryResponse = await fetch(`https://restcountries.com/v3.1/alpha/${countryCode}`);
      
      if (!countryResponse.ok) {
        throw new Error(`Failed to fetch country: ${countryResponse.status}`);
      }
      
      const countryData = await countryResponse.json();
      
      // Some countries might have 'subdivisions' field or similar
      let states = [];
      if (countryData[0] && countryData[0].subdivisions) {
        states = Object.entries(countryData[0].subdivisions)
          .map(([code, name]) => ({ name, code }))
          .sort((a, b) => a.name.localeCompare(b.name));
      }
      
      // Update cache
      apiCache.states[countryCode] = {
        data: states,
        lastFetched: Date.now()
      };
      
      return res.json(states);
    }
  } catch (error) {
    console.error(`Error fetching states for ${countryCode}:`, error);
    
    // Return cached data if available, even if expired
    if (apiCache.states[countryCode]) {
      return res.json(apiCache.states[countryCode].data);
    }
    
    // If no cached data and no fallback, return empty array
    return res.json([]);
  }
});

app.get('/api/cities/:countryCode/:regionCode', async (req, res) => {
  const { countryCode, regionCode } = req.params;
  const cacheKey = `${countryCode}-${regionCode}`;
  
  try {
    // Check if we have cached data
    if (apiCache.cities[cacheKey] && 
        apiCache.cities[cacheKey].lastFetched && 
        (Date.now() - apiCache.cities[cacheKey].lastFetched) < apiCache.cacheExpiryMs) {
      return res.json(apiCache.cities[cacheKey].data);
    }
    
    // For US states, use a basic fallback with major cities
    const usStateCities = {
      'CA': [
        { name: 'Los Angeles', code: 'LA' },
        { name: 'San Francisco', code: 'SF' },
        { name: 'San Diego', code: 'SD' },
        { name: 'Sacramento', code: 'SAC' }
      ],
      'NY': [
        { name: 'New York City', code: 'NYC' },
        { name: 'Buffalo', code: 'BUF' },
        { name: 'Albany', code: 'ALB' },
        { name: 'Rochester', code: 'ROC' }
      ],
      'TX': [
        { name: 'Houston', code: 'HOU' },
        { name: 'Dallas', code: 'DAL' },
        { name: 'Austin', code: 'AUS' },
        { name: 'San Antonio', code: 'SAT' }
      ]
    };
    
    // For Indian states, use fallback data for major states
    const indianStateCities = {
      'MH': [
        { name: 'Mumbai', code: 'BOM' },
        { name: 'Pune', code: 'PNQ' },
        { name: 'Nagpur', code: 'NAG' }
      ],
      'DL': [
        { name: 'New Delhi', code: 'DEL' },
        { name: 'Delhi', code: 'DLI' }
      ],
      'TN': [
        { name: 'Chennai', code: 'MAA' },
        { name: 'Coimbatore', code: 'CJB' },
        { name: 'Madurai', code: 'IXM' }
      ],
      'KA': [
        { name: 'Bangalore', code: 'BLR' },
        { name: 'Mysore', code: 'MYQ' },
        { name: 'Hubli', code: 'HBX' }
      ],
      'TG': [
        { name: 'Hyderabad', code: 'HYD' },
        { name: 'Warangal', code: 'WGC' }
      ],
      'WB': [
        { name: 'Kolkata', code: 'CCU' },
        { name: 'Siliguri', code: 'IXB' }
      ]
    };
    
    // Check for US fallback data
    if (countryCode === 'US' && usStateCities[regionCode]) {
      console.log(`Using US fallback data for cities in ${regionCode}`);
      apiCache.cities[cacheKey] = {
        data: usStateCities[regionCode],
        lastFetched: Date.now()
      };
      return res.json(usStateCities[regionCode]);
    }
    
    // Check for India fallback data
    if (countryCode === 'IN' && indianStateCities[regionCode]) {
      console.log(`Using India fallback data for cities in ${regionCode}`);
      apiCache.cities[cacheKey] = {
        data: indianStateCities[regionCode],
        lastFetched: Date.now()
      };
      return res.json(indianStateCities[regionCode]);
    }
    
    // Try to fetch from API
    try {
      // Fetch cities from GeoDB API
      const response = await fetch(
        `${GEODB_API_URL}/countries/${countryCode}/regions/${regionCode}/cities?limit=100&sort=-population`,
        {
          headers: {
            'X-RapidAPI-Key': GEODB_API_KEY,
            'X-RapidAPI-Host': 'wft-geo-db.p.rapidapi.com'
          }
        }
      );
      
      if (!response.ok) {
        throw new Error(`Failed to fetch cities: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Format cities data
      const cities = data.data
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(city => ({
          name: city.name,
          code: city.wikiDataId
        }));
      
      // Update cache
      apiCache.cities[cacheKey] = {
        data: cities,
        lastFetched: Date.now()
      };
      
      return res.json(cities);
    } catch (error) {
      console.error(`Error fetching cities from API: ${error.message}`);
      // Continue to fallback options
      throw error;
    }
  } catch (error) {
    console.error(`Error fetching cities for ${countryCode}/${regionCode}:`, error);
    
    // Return cached data if available, even if expired
    if (apiCache.cities[cacheKey]) {
      return res.json(apiCache.cities[cacheKey].data);
    }
    
    // If no cached data, return some generic cities as a last resort
    const genericCities = [
      { name: 'Main City', code: 'MAIN' },
      { name: 'Central City', code: 'CTY' },
      { name: 'Downtown', code: 'DWN' },
      { name: 'Uptown', code: 'UPT' }
    ];
    
    // Cache generic data to avoid future API calls for this region
    apiCache.cities[cacheKey] = {
      data: genericCities,
      lastFetched: Date.now()
    };
    
    return res.json(genericCities);
  }
});

// Maintain the original API endpoint for backward compatibility
app.get('/api/locations', async (req, res) => {
  try {
    // Try to fetch countries if we don't have them
    if (!apiCache.countries) {
      const countriesResponse = await fetch('/api/countries');
      apiCache.countries = await countriesResponse.json();
    }
    
    // Return a message to upgrade client-side code
    res.json({
      message: "Please update your client to use the new location API endpoints",
      endpoints: {
        countries: "/api/countries",
        states: "/api/states/:countryCode",
        cities: "/api/cities/:countryCode/:regionCode"
      },
      // Provide fallback data for backward compatibility
      fallbackData: {
        "United States": {
          "California": {
            "Los Angeles": ["Hollywood", "Downtown"],
            "San Francisco": []
          },
          "New York": {
            "New York City": ["Manhattan", "Brooklyn", "Queens"]
          }
        },
        "India": {
          "Maharashtra": {
            "Mumbai": []
          },
          "Delhi": {
            "New Delhi": []
          }
        }
      }
    });
  } catch (error) {
    console.error('Error in legacy location API:', error);
    res.status(500).json({ error: 'Failed to fetch location data' });
  }
});

// Item routes
const itemRoutes = require('./routes/items');
app.use('/items', itemRoutes(db, upload));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).render('error', { 
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err : {}
  });
});

// Handle 404 errors
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