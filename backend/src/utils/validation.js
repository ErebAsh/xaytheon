// Input validation utilities
const validator = require('validator');

class ValidationError extends Error {
  constructor(message, field) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
    this.statusCode = 400;
  }
}

// Sanitization functions
function sanitizeString(input, options = {}) {
  if (typeof input !== 'string') return '';

  const { maxLength = 1000, allowHtml = false } = options;

  let sanitized = input.trim();

  if (!allowHtml) {
    // Remove HTML tags and encode special characters
    sanitized = validator.escape(sanitized);
  }

  return sanitized.substring(0, maxLength);
}

function sanitizeEmail(email) {
  if (typeof email !== 'string') return '';
  return validator.normalizeEmail(email.trim(), {
    gmail_remove_dots: false,
    gmail_remove_subaddress: false,
    outlookdotcom_remove_subaddress: false,
    yahoo_remove_subaddress: false,
    icloud_remove_subaddress: false
  }) || '';
}

// Validation functions
function validateEmail(email) {
  if (!email || typeof email !== 'string') {
    throw new ValidationError('Email is required', 'email');
  }

  const sanitized = sanitizeEmail(email);
  if (!sanitized) {
    throw new ValidationError('Invalid email format', 'email');
  }

  if (!validator.isEmail(sanitized)) {
    throw new ValidationError('Please provide a valid email address', 'email');
  }

  if (sanitized.length > 254) {
    throw new ValidationError('Email is too long', 'email');
  }

  return sanitized;
}

function validatePassword(password) {
  if (!password || typeof password !== 'string') {
    throw new ValidationError('Password is required', 'password');
  }

  if (password.length < 8) {
    throw new ValidationError('Password must be at least 8 characters long', 'password');
  }

  if (password.length > 128) {
    throw new ValidationError('Password must be less than 128 characters', 'password');
  }

  // Check for common weak passwords (optional)
  const weakPasswords = ['password', '12345678', 'qwerty', 'abc123'];
  if (weakPasswords.includes(password.toLowerCase())) {
    throw new ValidationError('Password is too weak', 'password');
  }

  return password;
}

function validateString(input, fieldName, options = {}) {
  const { required = false, minLength = 0, maxLength = 1000, allowEmpty = false } = options;

  if (required && (!input || typeof input !== 'string' || input.trim().length === 0)) {
    throw new ValidationError(`${fieldName} is required`, fieldName);
  }

  if (!input && !required) return '';

  if (typeof input !== 'string') {
    throw new ValidationError(`${fieldName} must be a string`, fieldName);
  }

  const sanitized = sanitizeString(input, { maxLength });

  if (required && sanitized.length === 0 && !allowEmpty) {
    throw new ValidationError(`${fieldName} cannot be empty`, fieldName);
  }

  if (sanitized.length < minLength) {
    throw new ValidationError(`${fieldName} must be at least ${minLength} characters`, fieldName);
  }

  return sanitized;
}

function validateUrl(url, fieldName) {
  if (!url || typeof url !== 'string') return '';

  const sanitized = sanitizeString(url, { maxLength: 500 });

  if (sanitized && !validator.isURL(sanitized, {
    protocols: ['http', 'https'],
    require_protocol: true
  })) {
    throw new ValidationError(`${fieldName} must be a valid HTTP or HTTPS URL`, fieldName);
  }

  return sanitized;
}

function validateNumber(input, fieldName, options = {}) {
  const { required = false, min = -Infinity, max = Infinity, integer = false } = options;

  if (required && (input === null || input === undefined || input === '')) {
    throw new ValidationError(`${fieldName} is required`, fieldName);
  }

  if (!required && (input === null || input === undefined || input === '')) {
    return null;
  }

  const num = integer ? parseInt(input, 10) : parseFloat(input);

  if (isNaN(num)) {
    throw new ValidationError(`${fieldName} must be a valid number`, fieldName);
  }

  if (num < min || num > max) {
    throw new ValidationError(`${fieldName} must be between ${min} and ${max}`, fieldName);
  }

  return num;
}

function validateArray(input, fieldName, options = {}) {
  const { required = false, maxLength = 100, itemValidator } = options;

  if (required && (!Array.isArray(input))) {
    throw new ValidationError(`${fieldName} must be an array`, fieldName);
  }

  if (!required && !Array.isArray(input)) return [];

  if (input.length > maxLength) {
    throw new ValidationError(`${fieldName} cannot contain more than ${maxLength} items`, fieldName);
  }

  if (itemValidator) {
    for (let i = 0; i < input.length; i++) {
      try {
        input[i] = itemValidator(input[i], `${fieldName}[${i}]`);
      } catch (error) {
        throw new ValidationError(`${fieldName}[${i}]: ${error.message}`, fieldName);
      }
    }
  }

  return input;
}

// Middleware for handling validation errors
function handleValidationError(err, req, res, next) {
  if (err instanceof ValidationError) {
    return res.status(err.statusCode).json({
      message: err.message,
      field: err.field
    });
  }
  next(err);
}

module.exports = {
  ValidationError,
  sanitizeString,
  sanitizeEmail,
  validateEmail,
  validatePassword,
  validateString,
  validateUrl,
  validateNumber,
  validateArray,
  handleValidationError
};