// Authentication middleware
const requireAuth = (req, res, next) => {
  if (!req.session.user) {
    req.flash('error', 'Je moet ingelogd zijn om deze pagina te bekijken');
    return res.redirect('/auth/login');
  }
  next();
};

// Admin authentication middleware
const requireAdmin = (req, res, next) => {
  if (!req.session.user) {
    req.flash('error', 'Je moet ingelogd zijn');
    return res.redirect('/beheer/login');
  }

  // Check if user is admin
  const { db } = require('../config/database');
  db.get(`
    SELECT au.id 
    FROM admin_users au 
    JOIN users u ON au.user_id = u.id 
    WHERE u.id = ?
  `, [req.session.user.id], (err, row) => {
    if (err || !row) {
      req.flash('error', 'Onvoldoende rechten');
      return res.redirect('/beheer/login');
    }
    next();
  });
};

// Profile completion check
const requireCompleteProfile = (req, res, next) => {
  if (!req.session.user.profile_completed) {
    req.flash('info', 'Vul eerst je profiel in om door te gaan');
    return res.redirect('/dashboard/profile-setup');
  }
  next();
};

module.exports = {
  requireAuth,
  requireAdmin,
  requireCompleteProfile
};