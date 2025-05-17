/**
 * Script to verify or create an admin user
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const connectDB = require('../config/database');

async function verifyAdmin() {
  try {
    console.log('Connecting to database...');
    await connectDB();
    
    // Check for any admin users
    const adminUsers = await User.find({ role: 'admin' });
    
    if (adminUsers.length > 0) {
      console.log('\nAdmin users found:');
      adminUsers.forEach((admin, index) => {
        console.log(`${index + 1}. ${admin.name} (${admin.email})`);
      });
      
      // Update the first admin's password for testing
      const adminUser = adminUsers[0];
      adminUser.password = 'admin123';
      await adminUser.save();
      
      console.log('\nAdmin credentials for testing:');
      console.log(`Email: ${adminUser.email}`);
      console.log(`Password: admin123`);
    } else {
      console.log('No admin users found. Creating a default admin user...');
      
      // Create default admin
      const newAdmin = new User({
        name: 'Admin User',
        email: 'admin@example.com',
        password: 'admin123',
        role: 'admin'
      });
      
      await newAdmin.save();
      console.log('\nDefault admin created:');
      console.log(`Email: admin@example.com`);
      console.log(`Password: admin123`);
    }
    
    console.log('\nYou can use these credentials to access the admin dashboard.');
    
    // Disconnect from database
    await mongoose.disconnect();
    console.log('Database connection closed');
    
  } catch (error) {
    console.error('Error verifying admin users:', error);
  }
}

// Run the function
verifyAdmin();
