// Create developer account using proper encryption
// 
// CRITICAL: This script uses storage.upsertUser() to ensure proper encryption.
// NEVER create users by directly inserting into the database with raw SQL.
// All user data must be encrypted through the storage layer.
import { DatabaseStorage } from './server/storage.js';
import bcrypt from 'bcrypt';

async function createDeveloper() {
  try {
    console.log('Creating developer account with proper encryption...');
    
    const storage = new DatabaseStorage();
    const hashedPassword = await bcrypt.hash('dev123', 10);
    
    // Use proper storage.upsertUser to ensure encryption
    const developer = await storage.upsertUser({
      id: 'dev_001',
      email: 'developer@synergasia.com',
      firstName: 'Developer',
      lastName: 'Admin', 
      role: 'developer',
      password: hashedPassword,
    });
    
    console.log('✓ Developer account created/updated with proper encryption');
    console.log('\nDeveloper Login Credentials:');
    console.log('Email: developer@synergasia.com');
    console.log('Password: dev123');
    console.log('\nAccess the developer dashboard at: /login');
    
    // Verify the user can be found by email
    const foundUser = await storage.getUserByEmail('developer@synergasia.com');
    if (foundUser && foundUser.id === 'dev_001') {
      console.log('✓ Email lookup verification passed');
    } else {
      console.error('✗ Email lookup verification failed');
    }
    
  } catch (error) {
    console.error('Error creating developer account:', error);
  } finally {
    process.exit(0);
  }
}

createDeveloper();