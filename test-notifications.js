/**
 * Push Notification Testing Script
 *
 * This script tests push notifications for MeetMeHalfway backend
 * Run with: node test-notifications.js
 *
 * Requirements:
 * - Backend server running on http://localhost:3000
 * - Valid user credentials (email/password)
 * - Device push token from the mobile app
 */

const axios = require('axios');

// Configuration
const API_BASE_URL = process.env.API_URL || 'http://localhost:3000/api/v1';
const TEST_EMAIL = process.env.TEST_EMAIL || 'test@example.com';
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'Test123456!';

// Test device information
const TEST_DEVICE = {
  deviceId: `test-device-${Date.now()}`,
  // Replace this with a real push token from your mobile app
  // You can get this from the app logs when it starts
  pushToken: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]',
  deviceType: 'android',
  deviceName: 'Test Device - Script'
};

let authToken = null;
let userId = null;

/**
 * Color codes for console output
 */
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✅ ${message}`, colors.green);
}

function logError(message) {
  log(`❌ ${message}`, colors.red);
}

function logInfo(message) {
  log(`ℹ️  ${message}`, colors.cyan);
}

function logWarning(message) {
  log(`⚠️  ${message}`, colors.yellow);
}

/**
 * Step 1: Sign in to get authentication token
 */
async function signIn() {
  try {
    logInfo('Step 1: Signing in...');

    const response = await axios.post(`${API_BASE_URL}/auth/signin`, {
      email: TEST_EMAIL,
      password: TEST_PASSWORD
    });

    if (response.data.requiresMfa) {
      logError('MFA is enabled for this account. Please use an account without MFA for testing.');
      process.exit(1);
    }

    authToken = response.data.accessToken;
    userId = response.data.user.id;

    logSuccess(`Signed in as ${response.data.user.email}`);
    logInfo(`User ID: ${userId}`);
    return true;
  } catch (error) {
    logError(`Sign in failed: ${error.response?.data?.message || error.message}`);
    return false;
  }
}

/**
 * Step 2: Register device for push notifications
 */
async function registerDevice() {
  try {
    logInfo('Step 2: Registering device for push notifications...');

    const response = await axios.post(
      `${API_BASE_URL}/auth/register-device`,
      TEST_DEVICE,
      {
        headers: {
          Authorization: `Bearer ${authToken}`
        }
      }
    );

    logSuccess('Device registered successfully');
    logInfo(`Device ID: ${TEST_DEVICE.deviceId}`);
    logInfo(`Push Token: ${TEST_DEVICE.pushToken.substring(0, 30)}...`);
    return true;
  } catch (error) {
    logError(`Device registration failed: ${error.response?.data?.message || error.message}`);
    if (error.response?.data) {
      console.error('Response data:', error.response.data);
    }
    return false;
  }
}

/**
 * Step 3: Get user devices to verify registration
 */
async function getUserDevices() {
  try {
    logInfo('Step 3: Fetching registered devices...');

    const response = await axios.post(
      `${API_BASE_URL}/auth/devices`,
      {},
      {
        headers: {
          Authorization: `Bearer ${authToken}`
        }
      }
    );

    const devices = response.data;
    logSuccess(`Found ${devices.length} registered device(s)`);

    devices.forEach((device, index) => {
      log(`\nDevice ${index + 1}:`, colors.bright);
      log(`  - ID: ${device.deviceId}`);
      log(`  - Type: ${device.deviceType}`);
      log(`  - Name: ${device.deviceName}`);
      log(`  - Push Token: ${device.pushToken.substring(0, 30)}...`);
      log(`  - Last Used: ${new Date(device.lastUsedAt).toLocaleString()}`);
    });

    return true;
  } catch (error) {
    logError(`Failed to fetch devices: ${error.response?.data?.message || error.message}`);
    return false;
  }
}

/**
 * Step 4: Send a test notification (requires manual trigger or event)
 */
async function testNotification() {
  logInfo('Step 4: Testing notification...');
  logWarning('Note: This test requires a real event to trigger a notification.');
  logWarning('To test notifications, create an event in the app and perform actions that trigger notifications.');

  log('\nNotification triggers available:', colors.bright);
  log('  1. Create an event and have another user request to join');
  log('  2. Accept/decline a join request');
  log('  3. Send a message in an event chat');
  log('  4. Cancel an event');
  log('  5. Check in to an event');

  return true;
}

/**
 * Main test execution
 */
async function runTests() {
  log('\n' + '='.repeat(60), colors.bright);
  log('  Push Notification Testing Script', colors.cyan);
  log('  MeetMeHalfway Backend', colors.cyan);
  log('='.repeat(60) + '\n', colors.bright);

  log('Configuration:', colors.bright);
  log(`  API URL: ${API_BASE_URL}`);
  log(`  Test Email: ${TEST_EMAIL}`);
  log(`  Device Type: ${TEST_DEVICE.deviceType}`);
  log(`  Device ID: ${TEST_DEVICE.deviceId}\n`);

  // Check if push token is set
  if (TEST_DEVICE.pushToken === 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]') {
    logWarning('⚠️  WARNING: You are using the default placeholder push token!');
    logWarning('Please update TEST_DEVICE.pushToken with a real token from your mobile app.');
    logWarning('You can find this in the app logs when it starts.\n');

    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });

    await new Promise(resolve => {
      readline.question('Do you want to continue anyway? (y/n): ', answer => {
        readline.close();
        if (answer.toLowerCase() !== 'y') {
          logInfo('Test cancelled. Please update the push token and try again.');
          process.exit(0);
        }
        resolve();
      });
    });
  }

  try {
    // Run tests sequentially
    const signInSuccess = await signIn();
    if (!signInSuccess) {
      logError('Cannot continue without authentication');
      process.exit(1);
    }

    log('');
    const registerSuccess = await registerDevice();
    if (!registerSuccess) {
      logError('Device registration failed');
    }

    log('');
    await getUserDevices();

    log('');
    await testNotification();

    log('\n' + '='.repeat(60), colors.bright);
    logSuccess('Tests completed!');
    log('='.repeat(60) + '\n', colors.bright);

  } catch (error) {
    logError(`Test execution failed: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

// Run the tests
runTests();
