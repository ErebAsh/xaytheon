// API Validation Test Script
const http = require('http');

const testCases = [
  {
    name: 'Empty JSON',
    body: '{}',
    expectedStatus: 400,
    expectedMessage: 'Email is required'
  },
  {
    name: 'Invalid email format',
    body: '{"email":"invalid","password":"short"}',
    expectedStatus: 400,
    expectedMessage: 'Please provide a valid email address'
  },
  {
    name: 'Short password',
    body: '{"email":"test@example.com","password":"short"}',
    expectedStatus: 400,
    expectedMessage: 'Password must be at least 8 characters long'
  },
  {
    name: 'Valid registration data',
    body: '{"email":"test@example.com","password":"validpassword123"}',
    expectedStatus: 201,
    expectedMessage: 'User registered successfully'
  }
];

function makeRequest(testCase, callback) {
  console.log(`\n🧪 Testing: ${testCase.name}`);

  const options = {
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/register',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(testCase.body)
    }
  };

  const req = http.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
      console.log(`📊 Status: ${res.statusCode}`);
      console.log(`📝 Response: ${data}`);

      try {
        const jsonResponse = JSON.parse(data);
        console.log(`✅ JSON Response: ${JSON.stringify(jsonResponse, null, 2)}`);
      } catch (e) {
        console.log(`❌ Not JSON response: ${data}`);
      }

      callback();
    });
  });

  req.on('error', (err) => {
    console.log(`❌ Network Error: ${err.message}`);
    callback();
  });

  req.write(testCase.body);
  req.end();
}

console.log('🚀 Starting API Validation Tests...\n');

let index = 0;
function runNextTest() {
  if (index < testCases.length) {
    makeRequest(testCases[index], () => {
      index++;
      setTimeout(runNextTest, 500); // Small delay between tests
    });
  } else {
    console.log('\n🎉 All validation tests completed!');
  }
}

runNextTest();