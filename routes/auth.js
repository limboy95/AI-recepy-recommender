const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const svgCaptcha = require('svg-captcha');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const { db } = require('../config/database');

const router = express.Router();

// Email transporter setup
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Generate CAPTCHA
router.get('/captcha', (req, res) => {
  const captcha = svgCaptcha.create({
    size: 4,
    noise: 2,
    color: true,
    background: '#f0f0f0'
  });
  
  req.session.captcha = captcha.text.toLowerCase();
  res.type('svg');
  res.send(captcha.data);
});

// Registration page
router.get('/register', (req, res) => {
  res.render('auth/register', { title: 'Registreren' });
});

// Registration handler
router.post('/register', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('Wachtwoord moet minimaal 8 karakters zijn'),
  body('confirmPassword').custom((value, { req }) => {
    if (value !== req.body.password) {
      throw new Error('Wachtwoorden komen niet overeen');
    }
    return true;
  }),
  body('captcha').notEmpty().withMessage('CAPTCHA is verplicht'),
  body('privacyAccepted').equals('on').withMessage('Privacyverklaring moet worden geaccepteerd')
], async (req, res) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    req.flash('error', errors.array().map(err => err.msg).join(', '));
    return res.redirect('/auth/register');
  }

  const { email, password, captcha } = req.body;

  // Verify CAPTCHA
  if (captcha.toLowerCase() !== req.session.captcha) {
    req.flash('error', 'CAPTCHA is incorrect');
    return res.redirect('/auth/register');
  }

  try {
    // Check if user already exists
    db.get('SELECT id FROM users WHERE email = ?', [email], async (err, row) => {
      if (err) {
        req.flash('error', 'Database error');
        return res.redirect('/auth/register');
      }

      if (row) {
        req.flash('error', 'Email is al in gebruik');
        return res.redirect('/auth/register');
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 12);
      const verificationToken = crypto.randomBytes(32).toString('hex');

      // Create user
      db.run(`
        INSERT INTO users (email, password_hash, privacy_accepted, verification_token)
        VALUES (?, ?, 1, ?)
      `, [email, hashedPassword, verificationToken], function(err) {
        if (err) {
          req.flash('error', 'Fout bij het aanmaken van account');
          return res.redirect('/auth/register');
        }

        // Send verification email
        const verificationUrl = `${req.protocol}://${req.get('host')}/auth/verify/${verificationToken}`;
        
        const mailOptions = {
          from: process.env.EMAIL_USER,
          to: email,
          subject: 'Bevestig je account - Slimme Recepten Assistent',
          html: `
            <h2>Welkom bij Slimme Recepten Assistent!</h2>
            <p>Klik op de onderstaande link om je account te bevestigen:</p>
            <a href="${verificationUrl}">Account bevestigen</a>
            <p>Deze link is 24 uur geldig.</p>
          `
        };

        transporter.sendMail(mailOptions, (err) => {
          if (err) {
            console.error('Email send error:', err);
          }
        });

        req.flash('success', 'Account aangemaakt! Check je email voor verificatie.');
        res.redirect('/auth/login');
      });
    });
  } catch (error) {
    req.flash('error', 'Er is een fout opgetreden');
    res.redirect('/auth/register');
  }
});

// Email verification
router.get('/verify/:token', (req, res) => {
  const { token } = req.params;

  db.run(`
    UPDATE users 
    SET email_verified = 1, verification_token = NULL 
    WHERE verification_token = ?
  `, [token], function(err) {
    if (err || this.changes === 0) {
      req.flash('error', 'Ongeldige of verlopen verificatielink');
      return res.redirect('/auth/login');
    }

    req.flash('success', 'Email succesvol geverifieerd! Je kunt nu inloggen.');
    res.redirect('/auth/login');
  });
});

// Login page
router.get('/login', (req, res) => {
  res.render('auth/login', { title: 'Inloggen' });
});

// Login handler
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
  body('captcha').notEmpty()
], (req, res) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    req.flash('error', 'Vul alle velden correct in');
    return res.redirect('/auth/login');
  }

  const { email, password, captcha } = req.body;

  // Verify CAPTCHA
  if (captcha.toLowerCase() !== req.session.captcha) {
    req.flash('error', 'CAPTCHA is incorrect');
    return res.redirect('/auth/login');
  }

  // Find user
  db.get(`
    SELECT id, email, password_hash, email_verified, profile_completed 
    FROM users 
    WHERE email = ?
  `, [email], async (err, user) => {
    if (err) {
      req.flash('error', 'Database error');
      return res.redirect('/auth/login');
    }

    if (!user) {
      req.flash('error', 'Ongeldige inloggegevens');
      return res.redirect('/auth/login');
    }

    if (!user.email_verified) {
      req.flash('error', 'Email nog niet geverifieerd. Check je inbox.');
      return res.redirect('/auth/login');
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    
    if (!isValidPassword) {
      req.flash('error', 'Ongeldige inloggegevens');
      return res.redirect('/auth/login');
    }

    // Update last login
    db.run('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);

    // Set session
    req.session.user = {
      id: user.id,
      email: user.email,
      profile_completed: user.profile_completed
    };

    // Redirect based on profile completion
    if (!user.profile_completed) {
      res.redirect('/dashboard/profile-setup');
    } else {
      res.redirect('/dashboard');
    }
  });
});

// Logout
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Session destroy error:', err);
    }
    res.redirect('/');
  });
});

// Password reset request
router.get('/forgot-password', (req, res) => {
  res.render('auth/forgot-password', { title: 'Wachtwoord vergeten' });
});

router.post('/forgot-password', [
  body('email').isEmail().normalizeEmail()
], (req, res) => {
  const { email } = req.body;
  
  const resetToken = crypto.randomBytes(32).toString('hex');
  const resetExpires = new Date(Date.now() + 3600000); // 1 hour

  db.run(`
    UPDATE users 
    SET reset_token = ?, reset_token_expires = ? 
    WHERE email = ?
  `, [resetToken, resetExpires, email], function(err) {
    if (err) {
      req.flash('error', 'Er is een fout opgetreden');
      return res.redirect('/auth/forgot-password');
    }

    if (this.changes > 0) {
      const resetUrl = `${req.protocol}://${req.get('host')}/auth/reset-password/${resetToken}`;
      
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Wachtwoord reset - Slimme Recepten Assistent',
        html: `
          <h2>Wachtwoord Reset</h2>
          <p>Klik op de onderstaande link om je wachtwoord te resetten:</p>
          <a href="${resetUrl}">Wachtwoord resetten</a>
          <p>Deze link is 1 uur geldig.</p>
        `
      };

      transporter.sendMail(mailOptions);
    }

    req.flash('success', 'Als het email adres bestaat, is er een reset link verstuurd.');
    res.redirect('/auth/login');
  });
});

// Password reset form
router.get('/reset-password/:token', (req, res) => {
  const { token } = req.params;
  
  db.get(`
    SELECT id FROM users 
    WHERE reset_token = ? AND reset_token_expires > CURRENT_TIMESTAMP
  `, [token], (err, user) => {
    if (err || !user) {
      req.flash('error', 'Ongeldige of verlopen reset link');
      return res.redirect('/auth/forgot-password');
    }

    res.render('auth/reset-password', { title: 'Wachtwoord resetten', token });
  });
});

// Password reset handler
router.post('/reset-password/:token', [
  body('password').isLength({ min: 8 }),
  body('confirmPassword').custom((value, { req }) => {
    if (value !== req.body.password) {
      throw new Error('Wachtwoorden komen niet overeen');
    }
    return true;
  })
], async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;
  
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    req.flash('error', errors.array().map(err => err.msg).join(', '));
    return res.redirect(`/auth/reset-password/${token}`);
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  db.run(`
    UPDATE users 
    SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL 
    WHERE reset_token = ? AND reset_token_expires > CURRENT_TIMESTAMP
  `, [hashedPassword, token], function(err) {
    if (err || this.changes === 0) {
      req.flash('error', 'Ongeldige of verlopen reset link');
      return res.redirect('/auth/forgot-password');
    }

    req.flash('success', 'Wachtwoord succesvol gewijzigd! Je kunt nu inloggen.');
    res.redirect('/auth/login');
  });
});

module.exports = router;
