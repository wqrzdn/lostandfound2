/**
 * Script to create an admin user
 * Run with: node scripts/create-admin.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const connectDB = require('../config/database');

// Admin user details
const adminData = {
  name: 'Admin User',
  email: 'admin@example.com',
  password: 'admin123',
  role: 'admin',
  isActive: true
};

async function createAdminUser() {
  try {
    // Connect to the database
    await connectDB();
    console.log('Connected to database');
    
    // Check if admin already exists
    const existingAdmin = await User.findOne({ email: adminData.email });
    
    if (existingAdmin) {
      console.log('Admin user already exists:', existingAdmin.email);
      console.log('Role:', existingAdmin.role);
      
      // Update to ensure admin role
      if (existingAdmin.role !== 'admin') {
        existingAdmin.role = 'admin';
        await existingAdmin.save();
        console.log('Updated user to admin role');
      }
    } else {
      // Create new admin user
      const admin = new User(adminData);
      await admin.save();
      console.log('Admin user created successfully:', admin.email);
    }
    
    // Disconnect
    mongoose.disconnect();
    console.log('Database connection closed');
  } catch (error) {
    console.error('Error creating admin user:', error);
    process.exit(1);
  }
}

// Run the function
createAdminUser(); 