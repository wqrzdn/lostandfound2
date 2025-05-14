// seed-users.js - Script to create test users for the application
const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

// MongoDB connection
const connectDB = async () => {
  try {
    const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!uri) {
      throw new Error('MongoDB connection URI not found in environment variables');
    }
    
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    
    console.log(`MongoDB Connected: ${mongoose.connection.host}`);
  } catch (err) {
    console.error(`MongoDB connection error: ${err.message}`);
    process.exit(1);
  }
};

// Create test users
const seedUsers = async () => {
  try {
    // Delete existing users (optional)
    await User.deleteMany({ email: { $in: ['admin@example.com', 'user@example.com'] } });
    
    // Create admin user
    const adminUser = new User({
      name: 'Admin User',
      email: 'admin@example.com',
      password: 'admin123',
      role: 'admin'
    });
    
    // Create regular user
    const regularUser = new User({
      name: 'Regular User',
      email: 'user@example.com',
      password: 'user123',
      role: 'user'
    });
    
    // Save users to database
    await Promise.all([
      adminUser.save(),
      regularUser.save()
    ]);
    
    console.log('Test users created successfully');
  } catch (err) {
    console.error('Error creating test users:', err);
  } finally {
    // Disconnect from database
    mongoose.disconnect();
    console.log('MongoDB disconnected');
  }
};

// Run the seed script
connectDB().then(() => {
  seedUsers();
});
