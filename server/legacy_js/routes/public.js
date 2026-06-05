const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const {
  SALT_ROUNDS,
  JWT_SECRET,
  JWT_ACCESS_EXPIRES_IN,
  JWT_REFRESH_TTL_MS,
  PASSWORD_RESET_TTL_MS,
  EMAIL_VERIFICATION_TTL_MS,
  FRONTEND_URL,
  REFRESH_TOKEN_BYTES
} = require('../config');
const {
  addMilliseconds,
  nowIso,
  generateRandomToken,
  hashToken
} = require('../utils');
const { query } = require('../db/connection'); // Correct import
const { sendVerificationEmail, sendPasswordResetEmail } = require('../services/emailService');

const router = express.Router();

const ensureTrialSubscriptionForSchool = async (schoolId) => {
  if (!schoolId) {
    return;
  }
  const existing = (await query('SELECT id FROM subscriptions WHERE school_id = $1 LIMIT 1', [schoolId])).rows[0];
  if (existing) {
    return;
  }
  const plan = (await query(
    'SELECT id, trial_duration_days FROM subscription_plans WHERE slug = $1 LIMIT 1',
    ['trial']
  )).rows[0];
  
  if (!plan) {
    return;
  }
  const startDate = nowIso();
  const trialEnds =
    typeof plan.trial_duration_days === 'number'
      ? new Date(Date.now() + plan.trial_duration_days * 86400000).toISOString()
      : null;
  
  await query(
    `INSERT INTO subscriptions (school_id, plan_id, status, start_date, trial_ends_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [schoolId, plan.id, 'active', startDate, trialEnds]
  );
};

const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many login attempts. Please try again later.'
});

const registerRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many registration attempts. Please try again later.'
});

const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false
});

router.post('/register-school', registerRateLimiter, async (req, res) => {
  try {
    const { schoolName, curriculum, adminName, email, password } = req.body;

    if (!schoolName || !curriculum || !adminName || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = (await query('SELECT id FROM users WHERE email = $1', [normalizedEmail])).rows[0];
    if (existingUser) {
      return res.status(409).json({ error: 'Email already in use' });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const schoolResult = await query(
      'INSERT INTO schools (name, curriculum, level, principal) VALUES ($1, $2, $3, $4) RETURNING id',
      [schoolName, curriculum, curriculum, adminName]
    );
    const schoolId = schoolResult.rows[0].id; 

    await ensureTrialSubscriptionForSchool(schoolId);

    const defaultLeaveTypes = [
      { name: 'Annual Leave', description: 'Annual vacation leave', max_days_per_year: 21, requires_approval: true },
      { name: 'Sick Leave', description: 'Leave due to illness', max_days_per_year: 10, requires_approval: true },
      { name: 'Maternity Leave', description: 'Maternity leave for female employees', max_days_per_year: 90, requires_approval: true },
      { name: 'Paternity Leave', description: 'Paternity leave for male employees', max_days_per_year: 14, requires_approval: true },
      { name: 'Compassionate Leave', description: 'Leave due to family emergencies', max_days_per_year: 5, requires_approval: true },
      { name: 'Study Leave', description: 'Leave for professional development', max_days_per_year: 10, requires_approval: true }
    ];

    for (const leaveType of defaultLeaveTypes) {
      await query(
        'INSERT INTO leave_types (school_id, name, description, max_days_per_year, requires_approval, is_active) VALUES ($1, $2, $3, $4, $5, true)',
        [schoolId, leaveType.name, leaveType.description, leaveType.max_days_per_year, leaveType.requires_approval]
      );
    }

    // Using "role" in quotes as it's a reserved word in PostgreSQL
    const userResult = await query(
      'INSERT INTO users (name, email, password_hash, "role", school_id) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [adminName, normalizedEmail, passwordHash, 'admin', schoolId]
    );
    const userId = userResult.rows[0].id;

    const verificationToken = generateRandomToken();
    const verificationHash = hashToken(verificationToken);
    const verificationExpiresAt = addMilliseconds(EMAIL_VERIFICATION_TTL_MS);

    await query(
      'INSERT INTO email_verification_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [userId, verificationHash, verificationExpiresAt]
    );

    sendVerificationEmail(normalizedEmail, verificationToken)
      .catch(err => console.error('Failed to send verification email:', err));

    res.status(201).json({
      message: 'Registration successful. Please verify your email address to activate your account.'
    });
  } catch (error) {
    console.error('School registration error:', error);
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

router.post('/login', loginRateLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Using "role" in quotes
    const user = (await query('SELECT id, name, email, password_hash, "role", school_id, is_verified, email_verified_at FROM users WHERE email = $1', [normalizedEmail])).rows[0];
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // CHECKING BOOLEAN (is_verified)
    if (user.role !== 'super_admin' && !user.is_verified) {
      return res.status(403).json({ error: 'Email address has not been verified yet.' });
    }

    await query('DELETE FROM refresh_tokens WHERE user_id = $1 AND expires_at <= $2', [user.id, nowIso()]);

    const refreshTokenValue = generateRandomToken(REFRESH_TOKEN_BYTES);
    const refreshTokenHash = hashToken(refreshTokenValue);
    const refreshTokenExpiresAt = addMilliseconds(JWT_REFRESH_TTL_MS);

    await query(
      'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [user.id, refreshTokenHash, refreshTokenExpiresAt]
    );

    let school = null;
    if (user.role !== 'super_admin' && user.school_id) {
      school = (await query('SELECT name, curriculum FROM schools WHERE id = $1', [user.school_id])).rows[0];
    }

    const accessPayload = {
      id: user.id,
      email: user.email,
      role: user.role,
      schoolId: user.school_id
    };

    const token = jwt.sign(accessPayload, JWT_SECRET, { expiresIn: JWT_ACCESS_EXPIRES_IN });

    res.json({
      token,
      refreshToken: refreshTokenValue,
      expiresIn: JWT_ACCESS_EXPIRES_IN,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        schoolId: user.school_id,
        schoolName: school?.name,
        schoolCurriculum: school?.curriculum,
        emailVerified: Boolean(user.is_verified), // CHECKING BOOLEAN
        emailVerifiedAt: user.email_verified_at,
        avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face'
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

router.post('/forgot-password', authRateLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = (await query('SELECT id, email FROM users WHERE email = $1', [normalizedEmail])).rows[0];

    if (!user) {
      return res.json({ message: 'If the email exists, reset instructions have been sent.' });
    }

    await query('DELETE FROM password_reset_tokens WHERE user_id = $1', [user.id]);

    const resetToken = generateRandomToken();
    const resetHash = hashToken(resetToken);
    const resetExpiresAt = addMilliseconds(PASSWORD_RESET_TTL_MS);

    await query(
      'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [user.id, resetHash, resetExpiresAt]
    );

    sendPasswordResetEmail(normalizedEmail, resetToken)
      .catch(err => console.error('Failed to send password reset email:', err));

    res.json({ message: 'If the email exists, reset instructions have been sent.' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Unable to process password reset request.' });
  }
});

router.post('/reset-password', authRateLimiter, async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ error: 'Token and new password are required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }

    const resetHash = hashToken(token);
    const resetRecord = (await query(
      'SELECT * FROM password_reset_tokens WHERE token_hash = $1',
      [resetHash]
    )).rows[0];

    if (
      !resetRecord ||
      resetRecord.used || // UPDATED: 1 -> true
      new Date(resetRecord.expires_at).getTime() < Date.now()
    ) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, resetRecord.user_id]);
    // UPDATED: 1 -> true
    await query('UPDATE password_reset_tokens SET used = true, used_at = $1 WHERE id = $2', [nowIso(), resetRecord.id]);
    await query('UPDATE refresh_tokens SET revoked = true, revoked_at = $1 WHERE user_id = $2', [nowIso(), resetRecord.user_id]);

    res.json({ message: 'Password has been reset successfully.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Unable to reset password.' });
  }
});

router.post('/verify-email', authRateLimiter, async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Verification token is required' });
    }

    const verificationHash = hashToken(token.trim());
    const verificationRecord = (await query(
      'SELECT * FROM email_verification_tokens WHERE token_hash = $1',
      [verificationHash]
    )).rows[0];

    if (!verificationRecord) {
      return res.status(400).json({ error: 'Invalid or expired verification token' });
    }

    // UPDATED: 1 -> true
    if (verificationRecord.used) {
      return res.status(400).json({ error: 'Verification token has already been used' });
    }

    if (new Date(verificationRecord.expires_at).getTime() < Date.now()) {
      return res.status(400).json({ error: 'Verification token has expired' });
    }

    const verifiedAt = nowIso();

    // UPDATED: 1 -> true (This was the line causing your error)
    await query('UPDATE users SET is_verified = true, email_verified_at = $1 WHERE id = $2', [verifiedAt, verificationRecord.user_id]);
    // UPDATED: 1 -> true
    await query('UPDATE email_verification_tokens SET used = true, used_at = $1 WHERE id = $2', [verifiedAt, verificationRecord.id]);
    // UPDATED: 0 -> false
    await query(
      'DELETE FROM email_verification_tokens WHERE user_id = $1 AND used = false AND id != $2',
      [verificationRecord.user_id, verificationRecord.id]
    );

    res.json({ message: 'Email verified successfully.' });
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({ error: 'Unable to verify email.' });
  }
});

router.post('/refresh-token', authRateLimiter, async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token is required' });
    }

    const refreshHash = hashToken(refreshToken);
    const tokenRecord = (await query(
      'SELECT * FROM refresh_tokens WHERE token_hash = $1',
      [refreshHash]
    )).rows[0];

    if (
      !tokenRecord ||
      tokenRecord.revoked || // UPDATED: 1 -> true
      new Date(tokenRecord.expires_at).getTime() < Date.now()
    ) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    // Using "role" in quotes
    const user = (await query('SELECT id, email, "role", school_id FROM users WHERE id = $1', [tokenRecord.user_id])).rows[0];

    if (!user) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    const newAccessToken = jwt.sign(
      { id: user.id, email: user.email, role: user.role, schoolId: user.school_id },
      JWT_SECRET,
      { expiresIn: JWT_ACCESS_EXPIRES_IN }
    );

    const nextRefreshValue = generateRandomToken(REFRESH_TOKEN_BYTES);
    const nextRefreshHash = hashToken(nextRefreshValue);
    const nextRefreshExpiresAt = addMilliseconds(JWT_REFRESH_TTL_MS);

    // UPDATED: 1 -> true
    await query('UPDATE refresh_tokens SET revoked = true, revoked_at = $1 WHERE id = $2', [nowIso(), tokenRecord.id]);
    await query(
      'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [user.id, nextRefreshHash, nextRefreshExpiresAt]
    );

    res.json({
      token: newAccessToken,
      refreshToken: nextRefreshValue,
      expiresIn: JWT_ACCESS_EXPIRES_IN
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({ error: 'Unable to refresh session.' });
  }
});

module.exports = { publicRouter: router };
