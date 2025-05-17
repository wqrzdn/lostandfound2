/**
 * Script to create or update admin user account
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const connectDB = require('../config/database');

// Admin credentials
const adminEmail = process.env.SECRET_ADMIN_EMAIL || 'admin@lostandfound.com';
const adminPassword = 'Atlas@Admin2025'; // Strong password for admin

async function createAdminUser() {
  try {
    console.log('Connecting to database...');
    await connectDB();
    
    // Check if admin user already exists
    const existingAdmin = await User.findOne({ email: adminEmail });
    
    if (existingAdmin) {
      console.log('Admin user already exists, updating password and role...');
      existingAdmin.password = adminPassword;
      existingAdmin.role = 'admin';
      await existingAdmin.save();
      console.log(`Admin user updated: ${adminEmail}`);
    } else {
      // Create new admin user
      const newAdmin = new User({
        name: 'MongoDB Atlas Admin',
        email: adminEmail,
        password: adminPassword,
        role: 'admin'
      });
      
      await newAdmin.save();
      console.log(`New admin user created: ${adminEmail}`);
    }
    
    console.log('Admin credentials:');
    console.log(`Email: ${adminEmail}`);
    console.log(`Password: ${adminPassword}`);
    console.log('\nYou can use these credentials to access the MongoDB Atlas admin dashboard');
    
    // Disconnect from database
    await mongoose.disconnect();
    console.log('Database connection closed');
    
    return { success: true };
  } catch (error) {
    console.error('Error creating admin user:', error);
    return { success: false, error: error.message };
  }
}

// Run the function
createAdminUser();
