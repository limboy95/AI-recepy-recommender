const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const svgCaptcha = require('svg-captcha');
const { db } = require('../config/database');
const { requireAdmin } = require('../middleware/auth');
const { updateBonusCache } = require('../services/bonusScraper');

const router = express.Router();

// Admin login page
router.get('/login', (req, res) => {
  res.render('admin/login', { title: 'Admin Login' });
});

// Admin login handler
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
  body('captcha').notEmpty()
], async (req, res) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    req.flash('error', 'Vul alle velden correct in');
    return res.redirect('/beheer/login');
  }

  const { email, password, captcha } = req.body;

  // Verify CAPTCHA
  if (captcha.toLowerCase() !== req.session.captcha) {
    req.flash('error', 'CAPTCHA is incorrect');
    return res.redirect('/beheer/login');
  }

  try {
    // Find admin user
    db.get(`
      SELECT u.id, u.email, u.password_hash, au.id as admin_id
      FROM users u
      JOIN admin_users au ON u.id = au.user_id
      WHERE u.email = ?
    `, [email], async (err, user) => {
      if (err) {
        req.flash('error', 'Database error');
        return res.redirect('/beheer/login');
      }

      if (!user) {
        req.flash('error', 'Ongeldige inloggegevens');
        return res.redirect('/beheer/login');
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password_hash);
      
      if (!isValidPassword) {
        req.flash('error', 'Ongeldige inloggegevens');
        return res.redirect('/beheer/login');
      }

      // Log admin activity
      db.run(`
        INSERT INTO admin_activity (admin_user_id, action, description, ip_address)
        VALUES (?, ?, ?, ?)
      `, [
        user.id,
        'Login',
        'Admin login successful',
        req.ip || req.connection.remoteAddress
      ]);

      // Set session
      req.session.user = {
        id: user.id,
        email: user.email,
        isAdmin: true
      };

      res.redirect('/beheer/dashboard');
    });
  } catch (error) {
    console.error('Admin login error:', error);
    req.flash('error', 'Er is een fout opgetreden');
    res.redirect('/beheer/login');
  }
});

// Apply admin auth to all routes below
router.use(requireAdmin);

// Admin dashboard
router.get('/dashboard', (req, res) => {
  const queries = {
    totalUsers: new Promise((resolve, reject) => {
      db.get('SELECT COUNT(*) as count FROM users', (err, row) => {
        if (err) reject(err);
        else resolve(row.count);
      });
    }),
    
    activeUsers: new Promise((resolve, reject) => {
      db.get(`
        SELECT COUNT(*) as count FROM users 
        WHERE last_login >= datetime('now', '-30 days')
      `, (err, row) => {
        if (err) reject(err);
        else resolve(row.count);
      });
    }),
    
    completedProfiles: new Promise((resolve, reject) => {
      db.get('SELECT COUNT(*) as count FROM users WHERE profile_completed = 1', (err, row) => {
        if (err) reject(err);
        else resolve(row.count);
      });
    }),
    
    totalRecipes: new Promise((resolve, reject) => {
      db.get('SELECT COUNT(*) as count FROM recipes', (err, row) => {
        if (err) reject(err);
        else resolve(row.count);
      });
    }),
    
    totalRecommendations: new Promise((resolve, reject) => {
      db.get('SELECT COUNT(*) as count FROM recipe_recommendations', (err, row) => {
        if (err) reject(err);
        else resolve(row.count);
      });
    }),
    
    totalBonusItems: new Promise((resolve, reject) => {
      db.get(`
        SELECT COUNT(*) as count FROM ah_bonus_items 
        WHERE valid_until >= date('now')
      `, (err, row) => {
        if (err) reject(err);
        else resolve(row.count);
      });
    }),
    
    recentUsers: new Promise((resolve, reject) => {
      db.all(`
        SELECT email, created_at, last_login, profile_completed
        FROM users 
        ORDER BY created_at DESC 
        LIMIT 10
      `, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    }),
    
    recentRecommendations: new Promise((resolve, reject) => {
      db.all(`
        SELECT u.email, r.title, rr.recommended_at, rr.user_rating
        FROM recipe_recommendations rr
        JOIN users u ON rr.user_id = u.id
        JOIN recipes r ON rr.recipe_id = r.id
        ORDER BY rr.recommended_at DESC
        LIMIT 10
      `, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    })
  };

  Promise.all([
    queries.totalUsers,
    queries.activeUsers,
    queries.completedProfiles,
    queries.totalRecipes,
    queries.totalRecommendations,
    queries.totalBonusItems,
    queries.recentUsers,
    queries.recentRecommendations
  ]).then(([
    totalUsers,
    activeUsers,
    completedProfiles,
    totalRecipes,
    totalRecommendations,
    totalBonusItems,
    recentUsers,
    recentRecommendations
  ]) => {
    res.render('admin/dashboard', {
      title: 'Admin Dashboard',
      stats: {
        totalUsers,
        activeUsers,
        completedProfiles,
        totalRecipes,
        totalRecommendations,
        totalBonusItems
      },
      recentUsers,
      recentRecommendations
    });
  }).catch(err => {
    console.error('Dashboard error:', err);
    req.flash('error', 'Fout bij het laden van dashboard');
    res.redirect('/beheer/login');
  });
});

// User management
router.get('/users', (req, res) => {
  const { filter } = req.query;
  
  let query = `
    SELECT u.*, up.diet_goal,
           COUNT(DISTINCT rr.id) as recommendation_count,
           COUNT(DISTINCT sl.id) as shopping_list_count
    FROM users u
    LEFT JOIN user_profiles up ON u.id = up.user_id
    LEFT JOIN recipe_recommendations rr ON u.id = rr.user_id
    LEFT JOIN shopping_lists sl ON u.id = sl.user_id
    WHERE 1=1
  `;
  
  const params = [];

  if (filter === 'active') {
    query += ` AND u.last_login >= datetime('now', '-30 days')`;
  } else if (filter === 'incomplete_profile') {
    query += ` AND u.profile_completed = 0`;
  } else if (filter === 'no_activity') {
    query += ` AND rr.id IS NULL`;
  }

  query += ` GROUP BY u.id ORDER BY u.created_at DESC`;

  db.all(query, params, (err, users) => {
    if (err) {
      console.error('User management error:', err);
      req.flash('error', 'Fout bij het laden van gebruikers');
      return res.redirect('/beheer/dashboard');
    }

    res.render('admin/users', {
      title: 'Gebruikersbeheer',
      users,
      filter
    });
  });
});

// User detail
router.get('/users/:id', (req, res) => {
  const { id } = req.params;

  const queries = {
    user: new Promise((resolve, reject) => {
      db.get(`
        SELECT u.*, up.*
        FROM users u
        LEFT JOIN user_profiles up ON u.id = up.user_id
        WHERE u.id = ?
      `, [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    }),
    
    recommendations: new Promise((resolve, reject) => {
      db.all(`
        SELECT r.title, r.image_url, rr.recommended_at, rr.user_rating, rr.user_feedback
        FROM recipe_recommendations rr
        JOIN recipes r ON rr.recipe_id = r.id
        WHERE rr.user_id = ?
        ORDER BY rr.recommended_at DESC
      `, [id], (err, rows) => {
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
      `, [id], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    }),
    
    fridgeItems: new Promise((resolve, reject) => {
      db.all('SELECT * FROM fridge_items WHERE user_id = ?', [id], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    })
  };

  Promise.all([queries.user, queries.recommendations, queries.shoppingLists, queries.fridgeItems])
    .then(([user, recommendations, shoppingLists, fridgeItems]) => {
      if (!user) {
        req.flash('error', 'Gebruiker niet gevonden');
        return res.redirect('/beheer/users');
      }

      // Parse JSON fields
      if (user.cuisine_preferences) {
        try {
          user.cuisine_preferences = JSON.parse(user.cuisine_preferences);
        } catch (e) {
          user.cuisine_preferences = [];
        }
      }
      if (user.diet_preferences) {
        try {
          user.diet_preferences = JSON.parse(user.diet_preferences);
        } catch (e) {
          user.diet_preferences = [];
        }
      }
      if (user.allergies) {
        try {
          user.allergies = JSON.parse(user.allergies);
        } catch (e) {
          user.allergies = [];
        }
      }

      res.render('admin/user-detail', {
        title: `Gebruiker: ${user.email}`,
        user,
        recommendations,
        shoppingLists,
        fridgeItems
      });
    })
    .catch(err => {
      console.error('User detail error:', err);
      req.flash('error', 'Fout bij het laden van gebruikersdetails');
      res.redirect('/beheer/users');
    });
});

// Recipe analytics
router.get('/recipes', (req, res) => {
  const queries = {
    popularRecipes: new Promise((resolve, reject) => {
      db.all(`
        SELECT r.title, r.image_url, COUNT(rr.id) as recommendation_count
        FROM recipes r
        LEFT JOIN recipe_recommendations rr ON r.id = rr.recipe_id
        GROUP BY r.id
        ORDER BY recommendation_count DESC
        LIMIT 20
      `, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    }),
    
    ratedRecipes: new Promise((resolve, reject) => {
      db.all(`
        SELECT r.title, r.image_url, 
               AVG(CAST(rr.user_rating as FLOAT)) as avg_rating,
               COUNT(rr.user_rating) as rating_count
        FROM recipes r
        JOIN recipe_recommendations rr ON r.id = rr.recipe_id
        WHERE rr.user_rating IS NOT NULL
        GROUP BY r.id
        HAVING rating_count >= 2
        ORDER BY avg_rating DESC
        LIMIT 20
      `, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    })
  };

  Promise.all([queries.popularRecipes, queries.ratedRecipes])
    .then(([popularRecipes, ratedRecipes]) => {
      res.render('admin/recipes', {
        title: 'Recept Analytics',
        popularRecipes,
        ratedRecipes
      });
    })
    .catch(err => {
      console.error('Recipe analytics error:', err);
      req.flash('error', 'Fout bij het laden van recept analytics');
      res.redirect('/beheer/dashboard');
    });
});

// Bonus management
router.get('/bonus', (req, res) => {
  db.all(`
    SELECT * FROM ah_bonus_items 
    WHERE valid_until >= date('now')
    ORDER BY discount_percentage DESC
  `, (err, bonusItems) => {
    if (err) {
      console.error('Bonus management error:', err);
      req.flash('error', 'Fout bij het laden van bonus items');
      return res.redirect('/beheer/dashboard');
    }

    const totalItems = bonusItems.length;
    const avgDiscount = bonusItems.length > 0 
      ? Math.round(bonusItems.reduce((sum, item) => sum + item.discount_percentage, 0) / bonusItems.length)
      : 0;

    res.render('admin/bonus', {
      title: 'Bonus Beheer',
      bonusItems,
      stats: {
        totalItems,
        avgDiscount
      }
    });
  });
});

// Refresh bonus cache
router.post('/bonus/refresh', async (req, res) => {
  try {
    const count = await updateBonusCache();
    
    // Log admin activity
    db.run(`
      INSERT INTO admin_activity (admin_user_id, action, description, ip_address)
      VALUES (?, ?, ?, ?)
    `, [
      req.session.user.id,
      'Bonus Cache Refresh',
      `Refreshed bonus cache, updated ${count} items`,
      req.ip || req.connection.remoteAddress
    ]);

    req.flash('success', `${count} bonus items bijgewerkt!`);
  } catch (error) {
    console.error('Bonus refresh error:', error);
    req.flash('error', `Fout bij het bijwerken van bonus cache: ${error.message}`);
  }
  
  res.redirect('/beheer/bonus');
});

// Admin logout
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Session destroy error:', err);
    }
    res.redirect('/beheer/login');
  });
});

module.exports = router;
