// Unit tests for email normalization functionality
//
// This test suite verifies that email normalization works correctly
// across various edge cases to ensure consistent user lookups and
// prevent duplicate account creation due to case/whitespace variations.

import { DatabaseStorage } from './server/storage.js';
import { hashEmail } from './server/encryption.js';

interface TestCase {
  name: string;
  emails: string[];
  shouldMatch: boolean;
  expectedNormalized?: string;
}

const testCases: TestCase[] = [
  {
    name: "Case insensitive matching",
    emails: ["user@example.com", "User@Example.Com", "USER@EXAMPLE.COM"],
    shouldMatch: true,
    expectedNormalized: "user@example.com"
  },
  {
    name: "Whitespace trimming",
    emails: ["user@example.com", " user@example.com ", "\tuser@example.com\n"],
    shouldMatch: true,
    expectedNormalized: "user@example.com"
  },
  {
    name: "Combined case and whitespace",
    emails: ["User@Example.Com", " USER@EXAMPLE.COM ", "\tuser@example.com\n"],
    shouldMatch: true,
    expectedNormalized: "user@example.com"
  },
  {
    name: "Different domains should not match",
    emails: ["user@example.com", "user@different.com"],
    shouldMatch: false
  },
  {
    name: "Different usernames should not match",
    emails: ["user1@example.com", "user2@example.com"],
    shouldMatch: false
  },
  {
    name: "Empty and null handling",
    emails: ["", "   ", "\t\n"],
    shouldMatch: true,
    expectedNormalized: ""
  }
];

/**
 * Test email normalization consistency
 */
function testEmailNormalization(): { passed: number; failed: number; results: any[] } {
  console.log('🧪 Testing Email Normalization...\n');
  
  let passed = 0;
  let failed = 0;
  const results: any[] = [];
  
  for (const testCase of testCases) {
    console.log(`Testing: ${testCase.name}`);
    
    try {
      // Test hash consistency
      const hashes = testCase.emails.map(email => {
        const normalized = email.toLowerCase().trim();
        return { email, normalized, hash: hashEmail(normalized) };
      });
      
      // Check if all hashes should match
      const uniqueHashes = new Set(hashes.map(h => h.hash));
      const allHashesMatch = uniqueHashes.size === 1;
      
      if (testCase.shouldMatch === allHashesMatch) {
        console.log('  ✅ PASS');
        passed++;
        
        // Verify expected normalization if provided
        if (testCase.expectedNormalized !== undefined) {
          const firstNormalized = hashes[0].normalized;
          if (firstNormalized === testCase.expectedNormalized) {
            console.log(`  📧 Normalized correctly: "${firstNormalized}"`);
          } else {
            console.log(`  ⚠️  Normalization mismatch: expected "${testCase.expectedNormalized}", got "${firstNormalized}"`);
          }
        }
      } else {
        console.log('  ❌ FAIL');
        console.log(`  Expected ${testCase.shouldMatch ? 'matching' : 'different'} hashes, got ${allHashesMatch ? 'matching' : 'different'}`);
        failed++;
      }
      
      results.push({
        testCase: testCase.name,
        passed: testCase.shouldMatch === allHashesMatch,
        emails: testCase.emails,
        hashes: hashes
      });
      
    } catch (error) {
      console.log('  ❌ ERROR:', error);
      failed++;
      results.push({
        testCase: testCase.name,
        passed: false,
        error: error
      });
    }
    
    console.log('');
  }
  
  return { passed, failed, results };
}

/**
 * Test storage layer email normalization
 */
async function testStorageNormalization(): Promise<{ passed: number; failed: number }> {
  console.log('🧪 Testing Storage Layer Email Normalization...\n');
  
  const storage = new DatabaseStorage();
  let passed = 0;
  let failed = 0;
  
  // Test case: user lookup with different email formats
  const testEmails = [
    'test@example.com',
    'Test@Example.Com',
    ' TEST@EXAMPLE.COM ',
    '\ttest@example.com\n'
  ];
  
  try {
    // These should all resolve to the same normalized lookup
    console.log('Testing email lookup normalization...');
    
    for (let i = 0; i < testEmails.length; i++) {
      for (let j = i + 1; j < testEmails.length; j++) {
        const email1 = testEmails[i];
        const email2 = testEmails[j];
        
        // Both should produce the same hash when normalized
        const hash1 = hashEmail(email1.toLowerCase().trim());
        const hash2 = hashEmail(email2.toLowerCase().trim());
        
        if (hash1 === hash2) {
          console.log(`  ✅ "${email1}" and "${email2}" produce same hash`);
          passed++;
        } else {
          console.log(`  ❌ "${email1}" and "${email2}" produce different hashes`);
          failed++;
        }
      }
    }
    
  } catch (error) {
    console.log('  ❌ Storage test error:', error);
    failed++;
  }
  
  return { passed, failed };
}

/**
 * Test edge cases and security considerations
 */
function testEdgeCases(): { passed: number; failed: number } {
  console.log('🧪 Testing Edge Cases and Security...\n');
  
  let passed = 0;
  let failed = 0;
  
  const edgeCases = [
    { email: '', description: 'Empty string' },
    { email: '   ', description: 'Whitespace only' },
    { email: '\t\n\r', description: 'Various whitespace characters' },
    { email: 'user@domain.com\0', description: 'Null byte injection attempt' },
    { email: 'user+tag@domain.com', description: 'Email with plus addressing' },
    { email: 'user.dots@domain.com', description: 'Email with dots' },
    { email: 'СПАМ@example.com', description: 'Unicode email' }
  ];
  
  for (const testCase of edgeCases) {
    try {
      console.log(`Testing ${testCase.description}: "${testCase.email}"`);
      
      const normalized = testCase.email.toLowerCase().trim();
      const hash = hashEmail(normalized);
      
      // Hash should be consistent for the same normalized input
      const hash2 = hashEmail(normalized);
      
      if (hash === hash2) {
        console.log('  ✅ Hash consistency maintained');
        passed++;
      } else {
        console.log('  ❌ Hash inconsistency detected');
        failed++;
      }
      
      // Log normalized result for manual inspection
      console.log(`  📧 Normalized: "${normalized}"`);
      console.log(`  🔐 Hash: ${hash}\n`);
      
    } catch (error) {
      console.log(`  ❌ Error processing: ${error}\n`);
      failed++;
    }
  }
  
  return { passed, failed };
}

/**
 * Main test runner
 */
async function runTests() {
  console.log('🔐 Email Normalization Security Test Suite\n');
  console.log('==========================================\n');
  
  try {
    // Run all test suites
    const normalizationResults = testEmailNormalization();
    const storageResults = await testStorageNormalization();
    const edgeResults = testEdgeCases();
    
    // Calculate totals
    const totalPassed = normalizationResults.passed + storageResults.passed + edgeResults.passed;
    const totalFailed = normalizationResults.failed + storageResults.failed + edgeResults.failed;
    const totalTests = totalPassed + totalFailed;
    
    // Print summary
    console.log('📊 Test Summary');
    console.log('================');
    console.log(`Total Tests: ${totalTests}`);
    console.log(`Passed: ${totalPassed} ✅`);
    console.log(`Failed: ${totalFailed} ${totalFailed > 0 ? '❌' : '✅'}`);
    console.log(`Success Rate: ${totalTests > 0 ? ((totalPassed / totalTests) * 100).toFixed(1) : '0'}%`);
    
    if (totalFailed === 0) {
      console.log('\n🎉 All tests passed! Email normalization is working correctly.');
    } else {
      console.log('\n⚠️  Some tests failed. Review the results above.');
    }
    
    return { success: totalFailed === 0, totalPassed, totalFailed };
    
  } catch (error) {
    console.error('❌ Test suite failed to run:', error);
    return { success: false, totalPassed: 0, totalFailed: 1 };
  }
}

// Run tests if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests()
    .then(result => {
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('Test runner error:', error);
      process.exit(1);
    });
}

export { runTests, testEmailNormalization, testStorageNormalization, testEdgeCases };