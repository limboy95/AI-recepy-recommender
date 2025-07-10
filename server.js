const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const recipeRoutes = require('./routes/recipes');
const shoppingRoutes = require('./routes/shopping');
const adminRoutes = require('./routes/admin');
const fridgeRoutes = require('./routes/fridge');

const { initializeDatabase } = require('./config/database');
const { startBonusScraper } = require('./services/bonusScraper');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key-change-this',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

app.use(flash());

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Global middleware for flash messages and user
app.use((req, res, next) => {
  res.locals.messages = req.flash();
  res.locals.user = req.session.user || null;
  next();
});

// Routes
app.use('/auth', authRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/api/recipes', recipeRoutes);
app.use('/api/shopping', shoppingRoutes);
app.use('/api/fridge', fridgeRoutes);
app.use('/beheer', adminRoutes);

// Home route
app.get('/', (req, res) => {
  res.render('home', { title: 'Slimme Recepten Assistent' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render('error', { 
    title: 'Error',
    message: process.env.NODE_ENV === 'production' ? 'Something went wrong!' : err.message 
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).render('404', { title: 'Page Not Found' });
});

// Initialize database and start server
async function startServer() {
  try {
    await initializeDatabase();
    console.log('Database initialized successfully');
    
    // Start bonus scraper cron job
    startBonusScraper();
    console.log('Bonus scraper started');
    
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();