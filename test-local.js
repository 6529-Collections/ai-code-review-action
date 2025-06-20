// Load environment variables from .env file for local testing
require('dotenv').config();

// Mock @actions/core for local testing
process.env.INPUT_GREETING = process.argv[2] || 'Hello World';
process.env.INPUT_ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || process.env.INPUT_ANTHROPIC_API_KEY;

const mockCore = {
  getInput: (name) => process.env[`INPUT_${name.toUpperCase()}`] || '',
  setOutput: (name, value) => console.log(`::set-output name=${name}::${value}`),
  info: (message) => console.log(`INFO: ${message}`),
  error: (message) => console.error(`ERROR: ${message}`),
  setFailed: (message) => {
    console.error(`FAILED: ${message}`);
    process.exit(1);
  }
};

// Replace @actions/core with mock
require.cache[require.resolve('@actions/core')] = {
  exports: mockCore
};

// Run the built action
require('./dist/index.js');