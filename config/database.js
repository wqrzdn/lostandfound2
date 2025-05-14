// database.js
const mongoose = require('mongoose');
require('dotenv').config();

/**
 * Connect to MongoDB database
 * @returns {Promise} Mongoose connection
 */
const connectDB = async () => {
  try {
    // Try the MONGODB_URI first, then fall back to MONGO_URI if needed
    const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
    
    if (!uri) {
      throw new Error('MongoDB connection URI not found in environment variables');
    }
    
    // Use proper connection options for Mongoose
    const conn = await mongoose.connect(uri, {
      // These options ensure a stable connection
      serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
      socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
    });
    
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (err) {
    console.error(`MongoDB connection error: ${err.message}`);
    console.error('Please ensure MongoDB is running and the connection string is correct');
    process.exit(1);
  }
};

module.exports = connectDB;
