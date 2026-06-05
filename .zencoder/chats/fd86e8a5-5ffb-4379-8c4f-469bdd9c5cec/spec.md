# Technical Specification - Security Enhancements

## Technical Context
- **Language**: Node.js (CommonJS)
- **Framework**: Express.js
- **Database**: PostgreSQL & SQLite
- **Encryption**: AES-256-CBC (via Node `crypto`)
- **Rate Limiting**: `express-rate-limit`

## Implementation Approach

### 1. Rate Limiting
- **Global Rate Limit**: Apply a general limit (e.g., 100 requests per 15 mins) to all `/api` routes.
- **Strict Rate Limit**: Apply a stricter limit (e.g., 5 requests per 15 mins) to authentication endpoints:
  - `POST /api/auth/login`
  - `POST /api/auth/register`
  - `POST /api/auth/forgot-password`
  - `POST /api/auth/reset-password`

### 2. Audit Logging
- **Database Table**: Create `audit_logs` table to store:
  - `id`, `school_id`, `user_id`, `action`, `resource_type`, `resource_id`, `old_values`, `new_values`, `ip_address`, `user_agent`, `created_at`.
- **Middleware/Utility**: 
  - A utility function `logAction` to be called in services/controllers.
  - A middleware to capture high-level API access if needed, though service-level logging is more granular for "who changed what".

### 3. Data Encryption at Rest (PII)
- **Security Utility**: Implement `encrypt(text)` and `decrypt(text)` using a `ENCRYPTION_KEY` from environment variables.
- **Sensitive Fields**:
  - `students`: `phone`, `email`, `address`, `medical_conditions`, `allergies`, `emergency_contact_phone`.
  - *Note*: `first_name` and `last_name` will NOT be encrypted initially to preserve searchability, unless a hashed search approach is implemented.
- **Service Integration**: 
  - Update `studentService.js` to encrypt fields before saving.
  - Update `studentService.js` to decrypt fields after fetching.

## Source Code Structure Changes
- **New Files**:
  - `server/middleware/rateLimiter.js`: Configuration for rate limits.
  - `server/utils/security.js`: Encryption/decryption logic.
  - `server/services/auditService.js`: Logic for writing to `audit_logs`.
- **Modified Files**:
  - `server/index.js`: Register rate limiting middleware.
  - `database/schema.sql`: Add `audit_logs` table.
  - `database/schema_sqlite.sql`: Add `audit_logs` table.
  - `server/services/studentService.js`: Integrate encryption/decryption.

## Phase 2: Advanced Security Enhancements

### 1. Multi-Factor Authentication (MFA)
- **Approach**: Implement TOTP (Time-based One-Time Password) using `otplib`.
- **User Experience**: 
  - Users can enable MFA in their profile.
  - A QR code is generated for scanning with apps like Google Authenticator.
  - Verification is required during login if MFA is enabled.

### 2. AI-Driven Threat Detection (Heuristic Monitoring)
- **Approach**: Implement a monitoring service that analyzes `activity_logs` for:
  - Excessive failed login attempts from a single IP (beyond standard rate limiting).
  - Geographically impossible logins (if IP geolocation is available).
  - Unusual hour access for specific roles (e.g., student account access at 3 AM).
- **Action**: Automatically flag accounts or temporarily block IPs based on risk score.

### 3. Data Anonymization for Reports
- **Approach**: Implement a utility to anonymize student PII in export/report modules.
- **Methods**:
  - Masking: `John Doe` -> `J*** D***`.
  - Pseudonymization: Replace names with unique non-identifying keys for analytics.

### 4. Zero Trust Micro-Segmentation (Application Level)
- **Approach**: Enforce stricter role-based and context-based access control.
- **Implementation**:
  - Validate not just the role, but the specific resource ownership (e.g., a teacher can only access grades for students in *their* courses).
  - Device fingerprinting to ensure sessions aren't hijacked across different devices.
