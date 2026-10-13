// Create admin account using proper encryption
// 
// CRITICAL: This script uses storage.upsertUser() to ensure proper encryption.
// NEVER create users by directly inserting into the database with raw SQL.
// All user data must be encrypted through the storage layer.
import { DatabaseStorage } from './server/storage.js';
import bcrypt from 'bcrypt';

async function createAdminUser() {
  try {
    console.log('Creating admin account with proper encryption...');
    
    const storage = new DatabaseStorage();
    const hashedPassword = await bcrypt.hash('hello', 10);
    
    // Use proper storage.upsertUser to ensure encryption
    const admin = await storage.upsertUser({
      id: 'admin_001',
      email: 'admin@synergasia.com',
      firstName: 'Admin',
      lastName: 'User',
      role: 'admin',
      password: hashedPassword,
    });
    
    console.log('✓ Admin account created/updated with proper encryption');
    console.log('\nAdmin Login Credentials:');
    console.log('Email: admin@synergasia.com');
    console.log('Password: hello');
    console.log('\nAccess the admin dashboard at: /login');
    
    // Verify the user can be found by email
    const foundUser = await storage.getUserByEmail('admin@synergasia.com');
    if (foundUser && foundUser.id === 'admin_001') {
      console.log('✓ Email lookup verification passed');
    } else {
      console.error('✗ Email lookup verification failed');
    }
    
  } catch (error) {
    console.error('Error creating admin account:', error);
  } finally {
    process.exit(0);
  }
}

createAdminUser();