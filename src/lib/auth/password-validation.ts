/**
 * Password Validation Utilities
 *
 * Enterprise-grade password validation with:
 * - Configurable complexity requirements
 * - Common password blacklist
 * - Strength scoring
 *
 * @module password-validation
 */

// ============================================
// Password Policy Configuration
// ============================================

export interface PasswordPolicy {
  /** Minimum password length */
  minLength: number;
  /** Maximum password length */
  maxLength: number;
  /** Require at least one uppercase letter */
  requireUppercase: boolean;
  /** Require at least one lowercase letter */
  requireLowercase: boolean;
  /** Require at least one number */
  requireNumber: boolean;
  /** Require at least one special character */
  requireSpecialChar: boolean;
  /** Minimum number of unique characters */
  minUniqueChars: number;
  /** Prevent common passwords */
  preventCommonPasswords: boolean;
  /** Prevent user info in password (email, name) */
  preventUserInfo: boolean;
}

// Default enterprise-grade password policy
export const DEFAULT_PASSWORD_POLICY: PasswordPolicy = {
  minLength: 8,
  maxLength: 128,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecialChar: false, // Set to false to be less restrictive but still secure
  minUniqueChars: 4,
  preventCommonPasswords: true,
  preventUserInfo: true,
};

// Stricter policy for admin/owner accounts
export const ADMIN_PASSWORD_POLICY: PasswordPolicy = {
  minLength: 12,
  maxLength: 128,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecialChar: true,
  minUniqueChars: 6,
  preventCommonPasswords: true,
  preventUserInfo: true,
};

// ============================================
// Common Passwords Blacklist (Top 100)
// ============================================

const COMMON_PASSWORDS = new Set([
  "password",
  "123456",
  "12345678",
  "qwerty",
  "abc123",
  "monkey",
  "1234567",
  "letmein",
  "trustno1",
  "dragon",
  "baseball",
  "iloveyou",
  "master",
  "sunshine",
  "ashley",
  "bailey",
  "passw0rd",
  "shadow",
  "123123",
  "654321",
  "superman",
  "qazwsx",
  "michael",
  "football",
  "password1",
  "password123",
  "batman",
  "login",
  "admin",
  "welcome",
  "solo",
  "princess",
  "starwars",
  "cheese",
  "121212",
  "qwerty123",
  "password12",
  "mustang",
  "jordan",
  "access",
  "buster",
  "1234qwer",
  "maggie",
  "letmein1",
  "master123",
  "zxcvbnm",
  "computer",
  "ranger",
  "photon",
  "harley",
  "pepper",
  "thunder",
  "ginger",
  "hello",
  "freedom",
  "whatever",
  "nicole",
  "hunter",
  "1q2w3e",
  "1q2w3e4r",
  "1qaz2wsx",
  "q1w2e3r4",
  "internet",
  "google",
  "facebook",
  "microsoft",
  "apple",
  "amazon",
  "twitter",
  "linkedin",
  "instagram",
  "snapchat",
  "youtube",
  "netflix",
  "spotify",
  "password!",
  "p@ssw0rd",
  "p@ssword",
  "pa$$word",
  "pa$$w0rd",
  "test123",
  "test1234",
  "testing",
  "changeme",
  "secret",
  "password2",
  "password3",
  "admin123",
  "admin1234",
  "root",
  "root123",
  "123456789",
  "12345678910",
  "1234567890",
  "0987654321",
  "qwertyuiop",
  "asdfghjkl",
  "zxcvbnm123",
  "abcd1234",
  "1234abcd",
]);

// ============================================
// Validation Result Types
// ============================================

export interface ValidationError {
  code: string;
  message: string;
}

export interface PasswordValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  strength: PasswordStrength;
  score: number; // 0-100
}

export type PasswordStrength =
  | "weak"
  | "fair"
  | "good"
  | "strong"
  | "excellent";

// ============================================
// Main Validation Function
// ============================================

/**
 * Validate a password against the specified policy
 *
 * @param password - The password to validate
 * @param policy - Password policy to use (defaults to DEFAULT_PASSWORD_POLICY)
 * @param userInfo - Optional user info to prevent in password
 * @returns Validation result with errors and strength score
 *
 * @example
 * ```ts
 * const result = validatePassword("MyP@ssw0rd!", DEFAULT_PASSWORD_POLICY, {
 *   email: "user@example.com",
 *   name: "John Doe"
 * });
 *
 * if (!result.isValid) {
 *   console.log(result.errors);
 * }
 * ```
 */
export function validatePassword(
  password: string,
  policy: PasswordPolicy = DEFAULT_PASSWORD_POLICY,
  userInfo?: { email?: string; name?: string }
): PasswordValidationResult {
  const errors: ValidationError[] = [];

  // Check minimum length
  if (password.length < policy.minLength) {
    errors.push({
      code: "MIN_LENGTH",
      message: `Password must be at least ${policy.minLength} characters long`,
    });
  }

  // Check maximum length
  if (password.length > policy.maxLength) {
    errors.push({
      code: "MAX_LENGTH",
      message: `Password must not exceed ${policy.maxLength} characters`,
    });
  }

  // Check uppercase requirement
  if (policy.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push({
      code: "UPPERCASE_REQUIRED",
      message: "Password must contain at least one uppercase letter",
    });
  }

  // Check lowercase requirement
  if (policy.requireLowercase && !/[a-z]/.test(password)) {
    errors.push({
      code: "LOWERCASE_REQUIRED",
      message: "Password must contain at least one lowercase letter",
    });
  }

  // Check number requirement
  if (policy.requireNumber && !/[0-9]/.test(password)) {
    errors.push({
      code: "NUMBER_REQUIRED",
      message: "Password must contain at least one number",
    });
  }

  // Check special character requirement
  if (
    policy.requireSpecialChar &&
    !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(password)
  ) {
    errors.push({
      code: "SPECIAL_CHAR_REQUIRED",
      message:
        "Password must contain at least one special character (!@#$%^&*...)",
    });
  }

  // Check unique characters
  const uniqueChars = new Set(password.toLowerCase()).size;
  if (uniqueChars < policy.minUniqueChars) {
    errors.push({
      code: "UNIQUE_CHARS",
      message: `Password must contain at least ${policy.minUniqueChars} unique characters`,
    });
  }

  // Check common passwords
  if (policy.preventCommonPasswords) {
    const lowerPassword = password.toLowerCase();
    if (COMMON_PASSWORDS.has(lowerPassword)) {
      errors.push({
        code: "COMMON_PASSWORD",
        message:
          "This password is too common. Please choose a stronger password.",
      });
    }
  }

  // Check user info in password
  if (policy.preventUserInfo && userInfo) {
    const lowerPassword = password.toLowerCase();

    if (userInfo.email) {
      const emailParts = userInfo.email.toLowerCase().split("@");
      const username = emailParts[0];
      if (username.length >= 3 && lowerPassword.includes(username)) {
        errors.push({
          code: "CONTAINS_EMAIL",
          message: "Password should not contain your email address",
        });
      }
    }

    if (userInfo.name) {
      const nameParts = userInfo.name.toLowerCase().split(/\s+/);
      for (const part of nameParts) {
        if (part.length >= 3 && lowerPassword.includes(part)) {
          errors.push({
            code: "CONTAINS_NAME",
            message: "Password should not contain your name",
          });
          break;
        }
      }
    }
  }

  // Calculate strength score
  const { strength, score } = calculatePasswordStrength(password, policy);

  return {
    isValid: errors.length === 0,
    errors,
    strength,
    score,
  };
}

// ============================================
// Password Strength Calculator
// ============================================

/**
 * Calculate password strength score
 * @param password - The password to analyze
 * @param policy - Password policy for context
 * @returns Strength category and numeric score (0-100)
 */
function calculatePasswordStrength(
  password: string,
  policy: PasswordPolicy
): { strength: PasswordStrength; score: number } {
  let score = 0;

  // Length scoring (up to 30 points)
  score += Math.min(30, password.length * 2);

  // Character variety (up to 40 points)
  if (/[a-z]/.test(password)) score += 10;
  if (/[A-Z]/.test(password)) score += 10;
  if (/[0-9]/.test(password)) score += 10;
  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(password)) score += 10;

  // Unique characters bonus (up to 20 points)
  const uniqueChars = new Set(password).size;
  score += Math.min(20, uniqueChars * 2);

  // Sequential/repeated character penalty
  if (/(.)\1{2,}/.test(password)) score -= 10; // Repeated chars like "aaa"
  if (/012|123|234|345|456|567|678|789|890/.test(password)) score -= 10; // Sequential numbers
  if (
    /abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz/i.test(
      password
    )
  ) {
    score -= 10; // Sequential letters
  }

  // Common password penalty
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    score = Math.max(0, score - 50);
  }

  // Normalize score to 0-100
  score = Math.max(0, Math.min(100, score));

  // Determine strength category
  let strength: PasswordStrength;
  if (score < 20) strength = "weak";
  else if (score < 40) strength = "fair";
  else if (score < 60) strength = "good";
  else if (score < 80) strength = "strong";
  else strength = "excellent";

  return { strength, score };
}

// ============================================
// Utility Functions
// ============================================

/**
 * Generate a secure random password
 * @param length - Password length (default: 16)
 * @param options - Character set options
 * @returns Random password string
 */
export function generateSecurePassword(
  length: number = 16,
  options: {
    uppercase?: boolean;
    lowercase?: boolean;
    numbers?: boolean;
    special?: boolean;
  } = { uppercase: true, lowercase: true, numbers: true, special: true }
): string {
  const uppercaseChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lowercaseChars = "abcdefghijklmnopqrstuvwxyz";
  const numberChars = "0123456789";
  const specialChars = "!@#$%^&*()_+-=[]{}|;:,.<>?";

  let chars = "";
  let password = "";

  // Build character set and ensure at least one from each required set
  if (options.uppercase !== false) {
    chars += uppercaseChars;
    password +=
      uppercaseChars[Math.floor(Math.random() * uppercaseChars.length)];
  }
  if (options.lowercase !== false) {
    chars += lowercaseChars;
    password +=
      lowercaseChars[Math.floor(Math.random() * lowercaseChars.length)];
  }
  if (options.numbers !== false) {
    chars += numberChars;
    password += numberChars[Math.floor(Math.random() * numberChars.length)];
  }
  if (options.special !== false) {
    chars += specialChars;
    password += specialChars[Math.floor(Math.random() * specialChars.length)];
  }

  // Fill remaining length
  const remainingLength = length - password.length;
  for (let i = 0; i < remainingLength; i++) {
    password += chars[Math.floor(Math.random() * chars.length)];
  }

  // Shuffle the password
  return password
    .split("")
    .sort(() => Math.random() - 0.5)
    .join("");
}

/**
 * Get human-readable password requirements
 * @param policy - Password policy
 * @returns Array of requirement strings
 */
export function getPasswordRequirements(
  policy: PasswordPolicy = DEFAULT_PASSWORD_POLICY
): string[] {
  const requirements: string[] = [];

  requirements.push(`At least ${policy.minLength} characters long`);

  if (policy.requireUppercase) {
    requirements.push("At least one uppercase letter (A-Z)");
  }
  if (policy.requireLowercase) {
    requirements.push("At least one lowercase letter (a-z)");
  }
  if (policy.requireNumber) {
    requirements.push("At least one number (0-9)");
  }
  if (policy.requireSpecialChar) {
    requirements.push("At least one special character (!@#$%^&*)");
  }
  if (policy.preventCommonPasswords) {
    requirements.push("Not a commonly used password");
  }

  return requirements;
}
