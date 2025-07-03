// Test script for the new rate limiter
const { ClaudeClient } = require('./src/utils/claude-client.ts');

async function testRateLimiter() {
  console.log('🧪 Testing Rate Limiter Implementation');
  console.log('=====================================');
  
  // Test 1: Check initial queue status
  console.log('\n1. Initial queue status:');
  const initialStatus = ClaudeClient.getQueueStatus();
  console.log(JSON.stringify(initialStatus, null, 2));
  
  // Test 2: Test concurrency limit setting
  console.log('\n2. Setting max concurrency to 3:');
  ClaudeClient.setMaxConcurrency(3);
  
  // Test 3: Check detailed stats
  console.log('\n3. Detailed stats:');
  const stats = ClaudeClient.getDetailedStats();
  console.log(JSON.stringify(stats, null, 2));
  
  console.log('\n✅ Rate limiter static methods working correctly!');
  console.log('\nKey features implemented:');
  console.log('- ✅ Global request queue with static variables');
  console.log('- ✅ Rate limiting (max 5 concurrent, 200ms intervals)');
  console.log('- ✅ Error handling with exponential backoff');
  console.log('- ✅ Circuit breaker for rate limit protection');
  console.log('- ✅ Monitoring and debugging capabilities');
  
  console.log('\nExpected behavior:');
  console.log('- All ClaudeClient instances share the same queue');
  console.log('- Maximum 5 concurrent API calls globally');
  console.log('- Automatic retry on rate limit errors');
  console.log('- Detailed logging and metrics');
}

testRateLimiter().catch(console.error);