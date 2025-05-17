/**
 * Script to create a test user account
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const connectDB = require('../config/database');

async function createTestUser() {
  try {
    console.log('Connecting to database...');
    await connectDB();
    
    // Check if test user already exists
    let testUser = await User.findOne({ email: 'user@example.com' });
    
    if (testUser) {
      console.log('Test user already exists, updating password...');
      testUser.password = 'user123';
      await testUser.save();
      console.log(`Test user updated: user@example.com`);
    } else {
      // Create new test user
      testUser = new User({
        name: 'Test User',
        email: 'user@example.com',
        password: 'user123',
        role: 'user'
      });
      
      await testUser.save();
      console.log(`New test user created: user@example.com`);
    }
    
    console.log('\nRegular user credentials for testing:');
    console.log(`Email: user@example.com`);
    console.log(`Password: user123`);
    console.log('\nYou can use these credentials to login as a regular user');
    
    // Disconnect from database
    await mongoose.disconnect();
    console.log('Database connection closed');
    
  } catch (error) {
    console.error('Error creating test user:', error);
  }
}

// Run the function
createTestUser();
