const express = require('express');
const { body, validationResult } = require('express-validator');
const { db } = require('../config/database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Apply auth middleware to all dashboard routes
router.use(requireAuth);

// Dashboard home
router.get('/', (req, res) => {
  if (!req.session.user.profile_completed) {
    return res.redirect('/dashboard/profile-setup');
  }

  // Get user's recent activity
  const queries = {
    fridgeItems: new Promise((resolve, reject) => {
      db.all(`
        SELECT * FROM fridge_items 
        WHERE user_id = ? 
        ORDER BY added_at DESC 
        LIMIT 5
      `, [req.session.user.id], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    }),
    
    recentRecommendations: new Promise((resolve, reject) => {
      db.all(`
        SELECT r.title, r.image_url, rr.recommended_at, rr.user_rating
        FROM recipe_recommendations rr
        JOIN recipes r ON rr.recipe_id = r.id
        WHERE rr.user_id = ?
        ORDER BY rr.recommended_at DESC
        LIMIT 5
      `, [req.session.user.id], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    }),

    shoppingLists: new Promise((resolve, reject) => {
      db.all(`
        SELECT sl.*, COUNT(sli.id) as item_count
        FROM shopping_lists sl
        LEFT JOIN shopping_list_items sli ON sl.id = sli.shopping_list_id
        WHERE sl.user_id = ?
        GROUP BY sl.id
        ORDER BY sl.created_at DESC
        LIMIT 3
      `, [req.session.user.id], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    })
  };

  Promise.all([queries.fridgeItems, queries.recentRecommendations, queries.shoppingLists])
    .then(([fridgeItems, recentRecommendations, shoppingLists]) => {
      res.render('dashboard/home', {
        title: 'Dashboard',
        fridgeItems,
        recentRecommendations,
        shoppingLists
      });
    })
    .catch(err => {
      console.error('Dashboard error:', err);
      req.flash('error', 'Er is een fout opgetreden bij het laden van het dashboard');
      res.redirect('/');
    });
});

// Profile setup page
router.get('/profile-setup', (req, res) => {
  res.render('dashboard/profile-setup', { title: 'Profiel Instellen' });
});

// Profile setup handler
router.post('/profile-setup', [
  body('cuisinePreferences').optional().isArray(),
  body('dietPreferences').optional().isArray(),
  body('allergies').optional().isArray(),
  body('dislikes').optional().isString(),
  body('dietGoal').optional().isString()
], (req, res) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    req.flash('error', 'Ongeldige invoer');
    return res.redirect('/dashboard/profile-setup');
  }

  const {
    cuisinePreferences = [],
    dietPreferences = [],
    allergies = [],
    dislikes = '',
    dietGoal = ''
  } = req.body;

  // Check if profile already exists
  db.get('SELECT id FROM user_profiles WHERE user_id = ?', [req.session.user.id], (err, row) => {
    if (err) {
      req.flash('error', 'Database error');
      return res.redirect('/dashboard/profile-setup');
    }

    const profileData = [
      JSON.stringify(cuisinePreferences),
      JSON.stringify(dietPreferences),
      JSON.stringify(allergies),
      dislikes,
      dietGoal,
      req.session.user.id
    ];

    if (row) {
      // Update existing profile
      db.run(`
        UPDATE user_profiles 
        SET cuisine_preferences = ?, diet_preferences = ?, allergies = ?, 
            dislikes = ?, diet_goal = ?, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ?
      `, profileData, (err) => {
        if (err) {
          req.flash('error', 'Fout bij het bijwerken van profiel');
          return res.redirect('/dashboard/profile-setup');
        }

        // Mark profile as completed
        db.run('UPDATE users SET profile_completed = 1 WHERE id = ?', [req.session.user.id], (err) => {
          if (err) {
            console.error('Error updating profile completion:', err);
          }
          
          req.session.user.profile_completed = true;
          req.flash('success', 'Profiel succesvol ingesteld!');
          res.redirect('/dashboard');
        });
      });
    } else {
      // Create new profile
      db.run(`
        INSERT INTO user_profiles (cuisine_preferences, diet_preferences, allergies, dislikes, diet_goal, user_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `, profileData, (err) => {
        if (err) {
          req.flash('error', 'Fout bij het aanmaken van profiel');
          return res.redirect('/dashboard/profile-setup');
        }

        // Mark profile as completed
        db.run('UPDATE users SET profile_completed = 1 WHERE id = ?', [req.session.user.id], (err) => {
          if (err) {
            console.error('Error updating profile completion:', err);
          }
          
          req.session.user.profile_completed = true;
          req.flash('success', 'Profiel succesvol aangemaakt!');
          res.redirect('/dashboard');
        });
      });
    }
  });
});

// Profile edit page
router.get('/profile-edit', (req, res) => {
  db.get('SELECT * FROM user_profiles WHERE user_id = ?', [req.session.user.id], (err, profile) => {
    if (err) {
      req.flash('error', 'Fout bij het laden van profiel');
      return res.redirect('/dashboard');
    }

    // Parse JSON fields
    if (profile) {
      try {
        profile.cuisine_preferences = JSON.parse(profile.cuisine_preferences || '[]');
        profile.diet_preferences = JSON.parse(profile.diet_preferences || '[]');
        profile.allergies = JSON.parse(profile.allergies || '[]');
      } catch (e) {
        console.error('Error parsing profile JSON:', e);
      }
    }

    res.render('dashboard/profile-edit', { 
      title: 'Profiel Bewerken',
      profile: profile || {}
    });
  });
});

// Profile edit handler
router.post('/profile-edit', [
  body('cuisinePreferences').optional().isArray(),
  body('dietPreferences').optional().isArray(),
  body('allergies').optional().isArray(),
  body('dislikes').optional().isString(),
  body('dietGoal').optional().isString()
], (req, res) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    req.flash('error', 'Ongeldige invoer');
    return res.redirect('/dashboard/profile-edit');
  }

  const {
    cuisinePreferences = [],
    dietPreferences = [],
    allergies = [],
    dislikes = '',
    dietGoal = ''
  } = req.body;

  db.run(`
    UPDATE user_profiles 
    SET cuisine_preferences = ?, diet_preferences = ?, allergies = ?, 
        dislikes = ?, diet_goal = ?, updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ?
  `, [
    JSON.stringify(cuisinePreferences),
    JSON.stringify(dietPreferences),
    JSON.stringify(allergies),
    dislikes,
    dietGoal,
    req.session.user.id
  ], (err) => {
    if (err) {
      req.flash('error', 'Fout bij het bijwerken van profiel');
      return res.redirect('/dashboard/profile-edit');
    }

    req.flash('success', 'Profiel succesvol bijgewerkt!');
    res.redirect('/dashboard');
  });
});

module.exports = router;
