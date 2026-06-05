const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const helmet = require('helmet');
const hpp = require('hpp');
require('dotenv').config();

// Import PostgreSQL database connection
const { getDatabaseInfo } = require('./db/connection');

// Import environment config
const { isProduction, NODE_ENV, APP_ENV } = require('./config');

// Import routes
const authRoutes = require('./routes/auth');
const { publicRouter } = require('./routes/public');
const { secureRouter } = require('./routes/secure');
const completeRoutes = require('./routes/complete');
const studentsRoutes = require('./routes/students');
const assignmentsRoutes = require('./routes/assignments');
const schoolsRoutes = require('./routes/schools');
const subscriptionRoutes = require('./routes/subscription');
const examsRoutes = require('./routes/exams');
const coursesRoutes = require('./routes/courses');
const teacherRoutes = require('./routes/teacher');
const timetableRoutes = require('./routes/timetable');
const messagesRoutes = require('./routes/messages');
const notificationsRoutes = require('./routes/notifications');
const kenyaFeaturesRoutes = require('./routes/kenya-features');
const transportBoardingRoutes = require('./routes/transport-boarding');
const curriculumAssessmentRoutes = require('./routes/curriculum-assessment');
const paymentRoutes = require('./routes/payments');
const gradebookRoutes = require('./routes/gradebook');
const reportCardRoutes = require('./routes/reportCards');
const attendanceRoutes = require('./routes/attendance');
const payrollRoutes = require('./routes/payroll');

// Import middleware
const { authenticateToken } = require('./middleware/auth');
const { tenantContext } = require('./middleware/tenant');
const { apiLimiter, authLimiter } = require('./middleware/rateLimiter');
const { auditLogger } = require('./middleware/auditLogger');

const app = express();

app.set('trust proxy', 1);

// Security Middleware
app.use(helmet({
  contentSecurityPolicy: isProduction ? undefined : false, // Disable CSP in dev for easier debugging
  crossOriginEmbedderPolicy: false
}));
app.use(hpp());

// Middleware
const corsOptions = {
  origin: isProduction ? (process.env.CORS_ORIGIN || '').split(',') : 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  maxAge: 600 // Cache preflight requests for 10 minutes
};

app.use(cors(corsOptions));
app.use(bodyParser.json());
app.use(cookieParser());

// Serve uploaded files
app.use('/uploads', express.static('uploads'));

// Serve frontend static files (monorepo: frontend is built to ../dist)
const path = require('path');
const frontendPath = path.join(__dirname, '..', 'dist');
app.use(express.static(frontendPath, { 
  maxAge: isProduction ? '1y' : '0',
  etag: false 
}));

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const dbInfo = await getDatabaseInfo();
    res.json({
      status: 'healthy',
      database: dbInfo,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// API Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api', apiLimiter, tenantContext, auditLogger, publicRouter);
app.use('/api/students', apiLimiter, authenticateToken, tenantContext, auditLogger, studentsRoutes);
app.use('/api/assignments', apiLimiter, authenticateToken, tenantContext, auditLogger, assignmentsRoutes);
app.use('/api', apiLimiter, authenticateToken, tenantContext, auditLogger, schoolsRoutes);
app.use('/api', apiLimiter, authenticateToken, tenantContext, auditLogger, subscriptionRoutes);
app.use('/api', apiLimiter, authenticateToken, tenantContext, auditLogger, examsRoutes);
app.use('/api', apiLimiter, authenticateToken, tenantContext, auditLogger, coursesRoutes);
app.use('/api/teachers', apiLimiter, authenticateToken, tenantContext, auditLogger, teacherRoutes);

app.use('/api/timetable', apiLimiter, authenticateToken, tenantContext, auditLogger, timetableRoutes);
app.use('/api/messages', apiLimiter, authenticateToken, tenantContext, auditLogger, messagesRoutes);
app.use('/api', apiLimiter, authenticateToken, tenantContext, auditLogger, notificationsRoutes);
app.use('/api', apiLimiter, authenticateToken, tenantContext, auditLogger, secureRouter);
app.use('/api', apiLimiter, authenticateToken, tenantContext, auditLogger, completeRoutes);
app.use('/api/kenya-features', apiLimiter, authenticateToken, tenantContext, auditLogger, kenyaFeaturesRoutes);
app.use('/api/transport', apiLimiter, authenticateToken, tenantContext, auditLogger, transportBoardingRoutes);
app.use('/api/curriculum', apiLimiter, authenticateToken, tenantContext, auditLogger, curriculumAssessmentRoutes);
app.use('/api/payments', apiLimiter, authenticateToken, tenantContext, auditLogger, paymentRoutes);
app.use('/api/gradebook', apiLimiter, authenticateToken, tenantContext, auditLogger, gradebookRoutes);
app.use('/api/report-cards', apiLimiter, authenticateToken, tenantContext, auditLogger, reportCardRoutes);
app.use('/api/attendance', apiLimiter, authenticateToken, tenantContext, auditLogger, attendanceRoutes);
app.use('/api/payroll', apiLimiter, authenticateToken, tenantContext, auditLogger, payrollRoutes);

// Client-side routing fallback (for React Router)
// Any route not matched by API or static files serves index.html
app.use((req, res) => {
  // Skip API routes and static files
  if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/') || req.path === '/health') {
    return res.status(404).json({
      success: false,
      error: 'Endpoint not found'
    });
  }

  res.sendFile(path.join(frontendPath, 'index.html'), (err) => {
    if (err) {
      res.status(404).json({
        success: false,
        error: 'Not found'
      });
    }
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  if (res.headersSent) {
    return next(err);
  }
  const status = typeof err.status === 'number' ? err.status : 500;
  res.status(status).json({ 
    success: false,
    error: status === 500 ? 'Internal server error' : err.message || 'Internal server error' 
  });
});

const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;

// Start server with database info
app.listen(PORT, '0.0.0.0', async () => {
  console.log('\n' + '='.repeat(70));
  console.log('🚀 EduKE Server Started');
  console.log('='.repeat(70));
  console.log(`📍 Server listening on port: ${PORT}`);
  console.log(`🌍 NODE_ENV: ${NODE_ENV}`);
  console.log(`🌍 APP_ENV: ${APP_ENV}`);
  console.log(`⚙️  Environment Mode: ${isProduction ? 'PRODUCTION 🔒' : 'DEVELOPMENT'}`);
  console.log(`🔗 CORS Origin: ${process.env.CORS_ORIGIN || 'http://localhost:5173'}`);
  
  try {
    const dbInfo = await getDatabaseInfo();
    console.log(`💾 Database: ${dbInfo.config}`);
    console.log(`📊 Tables: ${dbInfo.tableCount} tables`);
    if (dbInfo.database) {
      console.log(`🗄️  Database Name: ${dbInfo.database}`);
    }
  } catch (error) {
    console.error('❌ Database connection error:', error.message);
  }
  
  console.log('='.repeat(70));
  console.log('✅ Ready to accept requests!\n');
});

module.exports = { app };
