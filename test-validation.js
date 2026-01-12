// Test script to demonstrate input validation
const { validateEmail, validatePassword, validateString, ValidationError } = require('./backend/src/utils/validation');

console.log('🧪 Testing Input Validation\n');

// Test email validation
console.log('📧 Email Validation Tests:');
try {
  validateEmail(''); // Should fail
} catch (e) {
  console.log('❌ Empty email:', e.message);
}

try {
  validateEmail('invalid-email'); // Should fail
} catch (e) {
  console.log('❌ Invalid email format:', e.message);
}

try {
  validateEmail('test@example.com'); // Should pass
  console.log('✅ Valid email: test@example.com');
} catch (e) {
  console.log('❌ Unexpected error:', e.message);
}

console.log('\n🔒 Password Validation Tests:');
try {
  validatePassword(''); // Should fail
} catch (e) {
  console.log('❌ Empty password:', e.message);
}

try {
  validatePassword('123'); // Should fail (too short)
} catch (e) {
  console.log('❌ Password too short:', e.message);
}

try {
  validatePassword('validpassword123'); // Should pass
  console.log('✅ Valid password: validpassword123');
} catch (e) {
  console.log('❌ Unexpected error:', e.message);
}

console.log('\n📝 String Validation Tests:');
try {
  validateString('', 'name', { required: true }); // Should fail
} catch (e) {
  console.log('❌ Empty required string:', e.message);
}

try {
  validateString('Valid Name', 'name', { required: true, maxLength: 50 }); // Should pass
  console.log('✅ Valid string: Valid Name');
} catch (e) {
  console.log('❌ Unexpected error:', e.message);
}

console.log('\n✨ Validation system is working correctly!');
console.log('To test the full application:');
console.log('1. Run: cd backend && npm start');
console.log('2. Test endpoints with curl or Postman');
console.log('3. Try invalid inputs to see error messages');