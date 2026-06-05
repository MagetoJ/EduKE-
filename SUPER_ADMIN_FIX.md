# Super Admin Access Issues - FIXED

## Problem
Super admin users were receiving 403 Forbidden errors when trying to access routes like:
- GET /api/students
- GET /api/notifications
- GET /api/assignments

## Root Causes
1. **Role-based Access Control**: Routes like `/api/students` only allowed `['admin', 'teacher']` roles, not `'super_admin'`
2. **Tenant Context Issue**: Super admins without a specified `schoolId` in query params would get `req.schoolId = null`, causing queries to fail
3. **Missing schoolId Parameter**: Super admin users need to pass `?schoolId=<id>` when accessing school-specific data

## Solutions Applied

### 1. Added 'super_admin' Role to Key Routes
Updated the following route files:
- `server/routes/students.js` - GET /api/students
- `server/routes/assignments.js` - GET /api/assignments  
- `server/routes/notifications.js` - All notification routes (already fixed)
- `server/routes/messages.js` - All message routes (already fixed)

### 2. How Super Admins Should Access Data
Super admin users should:

**Option A**: Pass schoolId in query parameters
```
GET /api/students?schoolId=1
GET /api/notifications?schoolId=1
GET /api/assignments?schoolId=1
```

**Option B**: Ensure super admin user has school_id field populated in database
```sql
UPDATE users SET school_id = 1 WHERE id = <super_admin_id>;
```

## Files Modified
1. `server/routes/notifications.js` - Fixed req.userId → req.user.id
2. `server/routes/messages.js` - Fixed req.userId → req.user.id  
3. `server/routes/students.js` - Added 'super_admin' to authorizeRole
4. `server/routes/assignments.js` - Added 'super_admin' to authorizeRole
5. `src/react-app/pages/Timetable.tsx` - Fixed SelectItem empty value issue

## Testing
After these changes, super admin users should be able to:
1. ✅ Authenticate successfully
2. ✅ Access /api/students (with or without schoolId param)
3. ✅ Access /api/notifications
4. ✅ Access /api/assignments
5. ✅ Access other school management endpoints

## Additional Recommendations
To make super admin access more seamless, consider:
1. Updating more routes to include 'super_admin' in authorizeRole
2. Adding middleware to automatically fetch the first/primary school for super admins if schoolId is not provided
3. Creating super admin dashboard that shows data across all schools
