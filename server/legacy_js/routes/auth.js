/**
 * Authentication Routes
 * Handles school registration, login, logout, password reset, etc.
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const authService = require('../services/authService');
const emailService = require('../services/emailService');
const mfaService = require('../services/mfaService');
const { query } = require('../db/connection');
const { authenticateToken } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
};

// Apply tenant context to all routes

/**
 * POST /api/auth/register-school
 * Register a new school with admin user
 */
router.post('/register-school', async (req, res) => {
  try {
    const { school, admin } = req.body;

    // Validate required fields
    if (!school?.name || !admin?.email || !admin?.password) {
      return res.status(400).json({
        success: false,
        error: 'School name, admin email, and password are required'
      });
    }

    if (!admin.firstName || !admin.lastName) {
      return res.status(400).json({
        success: false,
        error: 'Admin first name and last name are required'
      });
    }

    // Additional validation
    if (admin.password.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 8 characters long'
      });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(admin.email)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email format'
      });
    }

    // Register school
    const result = await authService.registerSchool(school, admin);

    // Send verification email
    if (result.verificationToken) {
      await emailService.sendVerificationEmail(admin.email, result.verificationToken);
    }

    res.status(201).json({
      success: true,
      message: 'School registered successfully. Please check your email to verify your account.',
      data: {
        school: result.school,
        user: result.user
      }
    });

  } catch (error) {
    console.error('School registration error:', error);

    // Handle specific errors
    let statusCode = 500;
    let errorMessage = 'Failed to register school';

    if (error.message === 'Email already registered') {
      statusCode = 409; // Conflict
      errorMessage = error.message;
    } else if (error.message === 'Trial plan not found') {
      statusCode = 500;
      errorMessage = 'Service configuration error';
    } else if (error.message) {
      errorMessage = error.message;
    }

    res.status(statusCode).json({
      success: false,
      error: errorMessage
    });
  }
});

/**
 * POST /api/auth/login
 * User login
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email format'
      });
    }

    // Authenticate user
    const result = await authService.login(email, password);

    // Set refresh token as httpOnly cookie
    res.cookie('refreshToken', result.refreshToken, cookieOptions);

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: result.user,
        accessToken: result.accessToken
      }
    });

  } catch (error) {
    console.error('Login error:', error);

    // Handle specific errors
    let statusCode = 401;
    let errorMessage = 'Invalid credentials';

    if (error.message === 'Account is not active') {
      statusCode = 403; // Forbidden
      errorMessage = error.message;
    } else if (error.message === 'School account is not active') {
      statusCode = 403;
      errorMessage = error.message;
    } else if (error.message) {
      errorMessage = error.message;
    }

    res.status(statusCode).json({
      success: false,
      error: errorMessage
    });
  }
});

/**
 * POST /api/auth/refresh-token
 * Refresh access token
 */
router.post('/refresh-token', async (req, res) => {
  try {
    // Get refresh token from cookie or body
    const refreshToken = req.cookies.refreshToken || req.body.refreshToken;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: 'Refresh token required'
      });
    }

    // Get new access token
    const result = await authService.refreshAccessToken(refreshToken);

    res.json({
      success: true,
      data: {
        accessToken: result.accessToken
      }
    });

  } catch (error) {
    console.error('Token refresh error:', error);

    // Handle specific errors
    let statusCode = 401;
    let errorMessage = 'Invalid refresh token';

    if (error.message === 'Invalid or expired refresh token') {
      errorMessage = error.message;
    } else if (error.message === 'User not found or inactive') {
      statusCode = 403;
      errorMessage = 'User account is inactive';
    } else if (error.message) {
      errorMessage = error.message;
    }

    res.status(statusCode).json({
      success: false,
      error: errorMessage
    });
  }
});

/**
 * POST /api/auth/logout
 * User logout
 */
router.post('/logout', async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken || req.body.refreshToken;

    if (refreshToken) {
      await authService.logout(refreshToken);
    }

    // Clear refresh token cookie
    res.clearCookie('refreshToken', { ...cookieOptions, maxAge: 0 });

    res.json({
      success: true,
      message: 'Logout successful'
    });

  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      error: 'Logout failed'
    });
  }
});

/**
 * POST /api/auth/forgot-password
 * Request password reset
 */
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email format'
      });
    }

    const result = await authService.requestPasswordReset(email);

    // Send password reset email
    if (result.resetToken) {
      await emailService.sendPasswordResetEmail(email, result.resetToken);
    }

    // Note: In production, send reset token via email
    // Don't return it in the response
    res.json({
      success: true,
      message: 'If the email exists, a reset link has been sent'
    });

  } catch (error) {
    console.error('Password reset request error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process password reset request'
    });
  }
});

/**
 * POST /api/auth/reset-password
 * Reset password with token
 */
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({
        success: false,
        error: 'Token and new password are required'
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 8 characters long'
      });
    }

    const result = await authService.resetPassword(token, password);

    res.json({
      success: true,
      message: result.message
    });

  } catch (error) {
    console.error('Password reset error:', error);

    // Handle specific errors
    let statusCode = 400;
    let errorMessage = 'Failed to reset password';

    if (error.message === 'Invalid or expired reset token') {
      statusCode = 401; // Unauthorized
      errorMessage = error.message;
    } else if (error.message) {
      errorMessage = error.message;
    }

    res.status(statusCode).json({
      success: false,
      error: errorMessage
    });
  }
});

/**
 * POST /api/auth/verify-email
 * Verify email address
 */
router.post('/verify-email', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'Verification token is required'
      });
    }

    const result = await authService.verifyEmail(token);

    res.json({
      success: true,
      message: result.message
    });

  } catch (error) {
    console.error('Email verification error:', error);

    // Handle specific errors
    let statusCode = 400;
    let errorMessage = 'Failed to verify email';

    if (error.message === 'Invalid or expired verification token') {
      statusCode = 401; // Unauthorized
      errorMessage = error.message;
    } else if (error.message) {
      errorMessage = error.message;
    }

    res.status(statusCode).json({
      success: false,
      error: errorMessage
    });
  }
});

/**
 * GET /api/auth/me
 * Get current user info (requires authentication)
 */
router.get('/me', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated'
      });
    }

    res.json({
      success: true,
      data: {
        user: req.user
      }
    });

  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get user information'
    });
  }
});

/**
 * POST /api/auth/change-password
 * Change user password (requires authentication)
 */
router.post('/change-password', authenticateToken, async (req, res) => {
  const { newPassword } = req.body;
  const { user } = req; // From authenticateToken middleware

  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ success: false, error: 'Password must be at least 6 characters' });
  }

  try {
    const password_hash = await bcrypt.hash(newPassword, 10);

    await query(
      'UPDATE users SET password_hash = $1, must_change_password = false, updated_at = NOW() WHERE id = $2',
      [password_hash, user.id]
    );

    res.json({ success: true, message: 'Password updated successfully' });

  } catch (err) {
    console.error('Error changing password:', err);
    res.status(500).json({ success: false, error: 'Failed to update password' });
  }
});

/**
 * POST /api/auth/mfa/setup
 * Initialize MFA setup for current user
 */
router.post('/mfa/setup', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const userEmail = req.user.email;
    
    const secret = mfaService.generateSecret();
    const qrCodeUrl = await mfaService.generateQRCode(userEmail, secret);
    
    // Store secret temporarily (not enabled yet)
    await query('UPDATE users SET mfa_secret = $1, mfa_enabled = false WHERE id = $2', [secret, userId]);
    
    res.json({
      success: true,
      data: {
        qrCodeUrl,
        secret // Provided for manual entry
      }
    });
  } catch (error) {
    console.error('MFA setup error:', error);
    res.status(500).json({ success: false, error: 'Failed to initialize MFA setup' });
  }
});

/**
 * POST /api/auth/mfa/verify
 * Complete MFA setup by verifying the first token
 */
router.post('/mfa/verify-setup', authenticateToken, async (req, res) => {
  try {
    const { token } = req.body;
    const userId = req.user.id;
    
    const userResult = await query('SELECT mfa_secret FROM users WHERE id = $1', [userId]);
    const secret = userResult.rows[0]?.mfa_secret;
    
    if (!secret) {
      return res.status(400).json({ success: false, error: 'MFA not initialized' });
    }
    
    const isValid = mfaService.verifyToken(token, secret);
    
    if (isValid) {
      await query('UPDATE users SET mfa_enabled = true WHERE id = $1', [userId]);
      res.json({ success: true, message: 'MFA enabled successfully' });
    } else {
      res.status(400).json({ success: false, error: 'Invalid verification token' });
    }
  } catch (error) {
    console.error('MFA verification error:', error);
    res.status(500).json({ success: false, error: 'Failed to verify MFA setup' });
  }
});

/**
 * POST /api/auth/mfa/login
 * Verify MFA token during login
 */
router.post('/mfa/login', async (req, res) => {
  try {
    const { email, token } = req.body;
    
    if (!email || !token) {
      return res.status(400).json({ success: false, error: 'Email and token are required' });
    }
    
    const userResult = await query('SELECT * FROM users WHERE email = $1', [email]);
    const user = userResult.rows[0];
    
    if (!user || !user.mfa_enabled || !user.mfa_secret) {
      return res.status(400).json({ success: false, error: 'MFA not enabled for this account' });
    }
    
    const isValid = mfaService.verifyToken(token, user.mfa_secret);
    
    if (!isValid) {
      return res.status(401).json({ success: false, error: 'Invalid MFA token' });
    }
    
    // Complete login by generating tokens
    // We need to call a service method that generates tokens without re-checking password
    const result = await authService.completeMfaLogin(user);
    
    // Set refresh token as httpOnly cookie
    res.cookie('refreshToken', result.refreshToken, cookieOptions);

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: result.user,
        accessToken: result.accessToken
      }
    });
  } catch (error) {
    console.error('MFA login error:', error);
    res.status(500).json({ success: false, error: 'MFA login failed' });
  }
});

module.exports = router;
