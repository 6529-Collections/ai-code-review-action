#!/usr/bin/env node

/**
 * Simple test script to verify PR comment posting works
 * Run this during manual workflow_dispatch to test comment functionality
 */

const { run } = require('./dist/index.js');

// Set test mode
process.env.TEST_COMMENT_POSTING = 'true';

// Run the test
run().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});