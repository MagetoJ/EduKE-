# Implementation Plan - Security Enhancements

## Task 1: Rate Limiting
1.  **Create Rate Limiter**: Implement `server/middleware/rateLimiter.js`.
2.  **Apply Middleware**: Integrate the rate limiter in `server/index.js`.
3.  **Verification**: Test with multiple requests to ensure blocks.

## Task 2: Audit Logging
1.  **Schema Update**: Add `audit_logs` table to `database/schema.sql` and `database/schema_sqlite.sql`.
2.  **Audit Service**: Create `server/services/auditService.js` to handle DB insertions.
3.  **Controller Integration**: Add logging calls to `server/services/studentService.js` (create, update, delete).
4.  **Verification**: Check DB for log entries after student operations.

## Task 3: Data Encryption at Rest
1.  **Security Utility**: Create `server/utils/security.js` with `encrypt` and `decrypt` functions.
2.  **Environment Config**: Add `ENCRYPTION_KEY` to `.env.example`.
3.  **Service Integration**:
    -   Modify `studentService.js` to encrypt PII before save/update.
    -   Modify `studentService.js` to decrypt PII after fetch.
4.  **Verification**: Ensure data is encrypted in DB but visible in frontend.

## Phase 2: Advanced Security Implementation
### Task 5: Multi-Factor Authentication
1. **Dependencies**: Install `otplib` and `qrcode`.
2. **Schema**: Add `mfa_secret` and `mfa_enabled` to `users` table.
3. **MFA Service**: Implement `server/services/mfaService.js`.
4. **Routes**: Add endpoints for MFA setup and verification in `auth.js`.

### Task 6: Threat Detection & Zero Trust
1. **Detection Logic**: Implement `server/services/threatDetectionService.js`.
2. **Middleware**: Add `microSegmentation` middleware to strictly validate resource ownership.
3. **Anonymization**: Implement `anonymize` utility in `server/utils/security.js`.
