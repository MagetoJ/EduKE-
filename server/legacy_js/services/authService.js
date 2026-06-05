/**
 * Authentication Service
 * Handles user authentication, school registration, and token management
 * Uses PostgreSQL database
 */

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { query, transaction } = require('../db/connection');
const { validatePassword } = require('../utils/passwordPolicy');
const { encrypt, decrypt } = require('../utils/security');
require('dotenv').config();

const {
  JWT_SECRET,
  JWT_REFRESH_SECRET,
  JWT_ACCESS_EXPIRES_IN,
  SALT_ROUNDS
} = require('../config');

const JWT_EXPIRES_IN = JWT_ACCESS_EXPIRES_IN;
const JWT_REFRESH_EXPIRES_IN = '7d';

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_TIME_MINUTES = 15;

const encryptUserPii = (user) => {
  if (!user) return user;
  const encrypted = { ...user };
  if (encrypted.phone) encrypted.phone = encrypt(encrypted.phone);
  return encrypted;
};

const decryptUserPii = (user) => {
  if (!user) return user;
  const decrypted = { ...user };
  if (decrypted.phone) decrypted.phone = decrypt(decrypted.phone);
  return decrypted;
};


/**
 * Register a new school with admin user
 * Creates school, subscription, and admin user in a transaction
 */
const registerSchool = async (schoolData, adminData) => {
  // 0. Validate password
  const passwordCheck = validatePassword(adminData.password);
  if (!passwordCheck.isValid) {
    throw new Error(passwordCheck.errors.join('. '));
  }

  return await transaction(async (client) => {
    // 1. Check if email already exists
    const existingUser = await client.query(
      'SELECT id FROM users WHERE email = $1',
      [adminData.email]
    );
    
    if (existingUser.rows.length > 0) {
      throw new Error('Email already registered');
    }
    
    // 2. Create school
    const schoolResult = await client.query(
      `INSERT INTO schools (
        name, email, phone, address, city, state, country,
        curriculum, level, principal, grade_levels, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        schoolData.name,
        schoolData.email || adminData.email,
        schoolData.phone,
        schoolData.address,
        schoolData.city,
        schoolData.state,
        schoolData.country || 'Kenya',
        schoolData.curriculum || 'cbc',
        schoolData.level,
        adminData.name || `${adminData.firstName} ${adminData.lastName}`,
        JSON.stringify(schoolData.gradeLevels || []),
        'active'
      ]
    );
    
    const school = schoolResult.rows[0];
    
    // 3. Get trial subscription plan
    const planResult = await client.query(
      'SELECT id FROM subscription_plans WHERE slug = $1 AND is_active = TRUE',
      ['trial']
    );
    
    if (planResult.rows.length === 0) {
      throw new Error('Trial plan not found');
    }
    
    const trialPlan = planResult.rows[0];
    
    // 4. Create subscription
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + 14); // 14 day trial
    
    await client.query(
      `INSERT INTO subscriptions (
        school_id, plan_id, status, start_date, end_date, 
        trial_ends_at, billing_cycle
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        school.id,
        trialPlan.id,
        'trial',
        new Date(),
        trialEndDate,
        trialEndDate,
        'monthly'
      ]
    );
    
    // 5. Hash password
    const passwordHash = await bcrypt.hash(adminData.password, SALT_ROUNDS);
    
    // 6. Create admin user
    const userResult = await client.query(
      `INSERT INTO users (
        school_id, email, password_hash, first_name, last_name, name,
        phone, role, status, is_verified
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id, school_id, email, first_name, last_name, name, role, status, phone`,
      [
        school.id,
        adminData.email,
        passwordHash,
        adminData.firstName,
        adminData.lastName,
        adminData.name || `${adminData.firstName} ${adminData.lastName}`,
        encrypt(adminData.phone),
        'admin',
        'active',
        false // Email verification required
      ]
    );
    
    const user = decryptUserPii(userResult.rows[0]);
    
    // 7. Generate email verification token (optional for later)
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(verificationToken).digest('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    
    await client.query(
      `INSERT INTO email_verification_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [user.id, tokenHash, expiresAt]
    );
    
    return {
      school,
      user,
      verificationToken // Send this via email
    };
  });
};

/**
 * Authenticate user and generate tokens
 */
const login = async (email, password) => {
  // 1. Find user by email
  const result = await query(
    `SELECT u.*, s.name as school_name, s.status as school_status, s.curriculum, u.must_change_password
     FROM users u
     LEFT JOIN schools s ON u.school_id = s.id
     WHERE u.email = $1`,
    [email]
  );
  
  if (result.rows.length === 0) {
    throw new Error('Invalid credentials');
  }
  
  const user = decryptUserPii(result.rows[0]);

  // 1.5 Check if account is locked
  if (user.account_locked_until && new Date(user.account_locked_until) > new Date()) {
    const remainingTime = Math.ceil((new Date(user.account_locked_until) - new Date()) / (60 * 1000));
    throw new Error(`Account is locked. Please try again in ${remainingTime} minutes.`);
  }
  
  // 2. Check if user is active
  if (user.status !== 'active') {
    throw new Error('Account is not active');
  }
  
  // 3. Check if school is active (for non-super admins)
  if (user.role !== 'super_admin' && user.school_status !== 'active') {
    throw new Error('School account is not active');
  }
  
  // 4. Verify password
  const isValidPassword = await bcrypt.compare(password, user.password_hash);
  
  if (!isValidPassword) {
    const attempts = (user.failed_login_attempts || 0) + 1;
    let lockedUntil = null;

    if (attempts >= MAX_FAILED_ATTEMPTS) {
      lockedUntil = new Date(Date.now() + LOCK_TIME_MINUTES * 60 * 1000);
    }

    await query(
      `UPDATE users 
       SET failed_login_attempts = $1, 
           last_failed_login_at = NOW(),
           account_locked_until = $2 
       WHERE id = $3`,
      [attempts, lockedUntil, user.id]
    );

    if (lockedUntil) {
      throw new Error(`Invalid credentials. Account has been locked for ${LOCK_TIME_MINUTES} minutes due to too many failed attempts.`);
    }

    throw new Error('Invalid credentials');
  }

  // 4.1 Reset failed attempts on success
  if (user.failed_login_attempts > 0) {
    await query(
      'UPDATE users SET failed_login_attempts = 0, account_locked_until = NULL WHERE id = $1',
      [user.id]
    );
  }

  // 4.5 Check if MFA is enabled
  if (user.mfa_enabled) {
    return {
      mfaRequired: true,
      email: user.email
    };
  }
  
  // 5. Generate access token
  const tokens = await generateAuthTokens(user);
  
  // 8. Update last login
  await query(
    'UPDATE users SET last_login_at = NOW() WHERE id = $1',
    [user.id]
  );
  
  // 9. Return user data (without password) and tokens
  delete user.password_hash;
  delete user.school_status;
  delete user.mfa_secret;
  
  return {
    user,
    ...tokens
  };
};

/**
 * Generate Access and Refresh tokens for a user
 */
const generateAuthTokens = async (user) => {
  // 1. Generate access token
  const accessToken = jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      schoolId: user.school_id,
      schoolName: user.school_name
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
  
  // 2. Generate refresh token
  const refreshToken = jwt.sign(
    { id: user.id, email: user.email },
    JWT_REFRESH_SECRET,
    { expiresIn: JWT_REFRESH_EXPIRES_IN }
  );
  
  // 3. Store refresh token in database
  const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  
  await query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [user.id, refreshTokenHash, expiresAt]
  );

  return { accessToken, refreshToken };
};

/**
 * Complete login after successful MFA verification
 */
const completeMfaLogin = async (user) => {
  const tokens = await generateAuthTokens(user);

  await query(
    'UPDATE users SET last_login_at = NOW() WHERE id = $1',
    [user.id]
  );

  const safeUser = decryptUserPii({ ...user });
  delete safeUser.password_hash;
  delete safeUser.mfa_secret;

  return {
    user: safeUser,
    ...tokens
  };
};

/**
 * Refresh access token using refresh token
 */
const refreshAccessToken = async (refreshToken) => {
  try {
    // 1. Verify refresh token
    const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
    
    // 2. Check if token exists in database and is not revoked
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    
    const tokenResult = await query(
      `SELECT * FROM refresh_tokens 
       WHERE token_hash = $1 AND user_id = $2 AND revoked = FALSE
       AND expires_at > NOW()`,
      [tokenHash, decoded.id]
    );
    
    if (tokenResult.rows.length === 0) {
      throw new Error('Invalid or expired refresh token');
    }
    
    // 3. Get user data
    const userResult = await query(
      `SELECT u.*, s.name as school_name
       FROM users u
       LEFT JOIN schools s ON u.school_id = s.id
       WHERE u.id = $1 AND u.status = 'active'`,
      [decoded.id]
    );
    
    if (userResult.rows.length === 0) {
      throw new Error('User not found or inactive');
    }
    
    const user = decryptUserPii(userResult.rows[0]);
    
    // 4. Generate new access token
    const accessToken = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        schoolId: user.school_id,
        schoolName: user.school_name
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );
    
    return { accessToken };
    
  } catch (error) {
    throw new Error('Invalid refresh token');
  }
};

/**
 * Logout user by revoking refresh token
 */
const logout = async (refreshToken) => {
  const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
  
  await query(
    `UPDATE refresh_tokens 
     SET revoked = TRUE, revoked_at = NOW()
     WHERE token_hash = $1`,
    [tokenHash]
  );
};

/**
 * Request password reset
 */
const requestPasswordReset = async (email) => {
  // 1. Find user
  const result = await query(
    'SELECT id, email FROM users WHERE email = $1 AND status = $2',
    [email, 'active']
  );
  
  if (result.rows.length === 0) {
    // Don't reveal if email exists
    return { message: 'If the email exists, a reset link has been sent' };
  }
  
  const user = result.rows[0];
  
  // 2. Generate reset token
  const resetToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  
  // 3. Store token
  await query(
    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [user.id, tokenHash, expiresAt]
  );
  
  return {
    resetToken, // Send this via email
    message: 'Password reset link sent'
  };
};

/**
 * Reset password using reset token
 */
const resetPassword = async (resetToken, newPassword) => {
  // 0. Validate new password
  const passwordCheck = validatePassword(newPassword);
  if (!passwordCheck.isValid) {
    throw new Error(passwordCheck.errors.join('. '));
  }

  return await transaction(async (client) => {
    // 1. Find valid token
    const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    
    const tokenResult = await client.query(
      `SELECT * FROM password_reset_tokens
       WHERE token_hash = $1 AND used = FALSE AND expires_at > NOW()`,
      [tokenHash]
    );
    
    if (tokenResult.rows.length === 0) {
      throw new Error('Invalid or expired reset token');
    }
    
    const token = tokenResult.rows[0];
    
    // 2. Hash new password
    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    
    // 3. Update user password
    await client.query(
      'UPDATE users SET password_hash = $1 WHERE id = $2',
      [passwordHash, token.user_id]
    );
    
    // 4. Mark token as used
    await client.query(
      'UPDATE password_reset_tokens SET used = TRUE, used_at = NOW() WHERE id = $1',
      [token.id]
    );
    
    // 5. Revoke all refresh tokens for security
    await client.query(
      'UPDATE refresh_tokens SET revoked = TRUE, revoked_at = NOW() WHERE user_id = $1',
      [token.user_id]
    );
    
    return { message: 'Password reset successful' };
  });
};

/**
 * Verify email address
 */
const verifyEmail = async (verificationToken) => {
  return await transaction(async (client) => {
    // 1. Find valid token
    const tokenHash = crypto.createHash('sha256').update(verificationToken).digest('hex');
    
    const tokenResult = await client.query(
      `SELECT * FROM email_verification_tokens
       WHERE token_hash = $1 AND used = FALSE AND expires_at > NOW()`,
      [tokenHash]
    );
    
    if (tokenResult.rows.length === 0) {
      throw new Error('Invalid or expired verification token');
    }
    
    const token = tokenResult.rows[0];
    
    // 2. Update user
    await client.query(
      'UPDATE users SET is_verified = TRUE, email_verified_at = NOW() WHERE id = $1',
      [token.user_id]
    );
    
    // 3. Mark token as used
    await client.query(
      'UPDATE email_verification_tokens SET used = TRUE, used_at = NOW() WHERE id = $1',
      [token.id]
    );
    
    return { message: 'Email verified successfully' };
  });
};

module.exports = {
  registerSchool,
  login,
  refreshAccessToken,
  logout,
  requestPasswordReset,
  resetPassword,
  verifyEmail
};
