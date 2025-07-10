const express = require('express');
const { body, validationResult } = require('express-validator');
const { db } = require('../config/database');
const { requireAuth, requireCompleteProfile } = require('../middleware/auth');
const { RecipeRecommendationService } = require('../services/recipeService');

const router = express.Router();

// Apply auth middleware
router.use(requireAuth);
router.use(requireCompleteProfile);

// Get recipe recommendations
router.get('/recommendations', async (req, res) => {
  try {
    // Get user's fridge items
    const fridgeItems = await new Promise((resolve, reject) => {
      db.all('SELECT * FROM fridge_items WHERE user_id = ?', [req.session.user.id], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    if (fridgeItems.length === 0) {
      return res.json({ 
        message: 'Voeg eerst ingrediënten toe aan je koelkast om receptaanbevelingen te krijgen',
        recipes: []
      });
    }

    // Get recommendations
    const recommendationService = new RecipeRecommendationService();
    const recommendedRecipes = await recommendationService.getRecommendations(
      req.session.user.id,
      fridgeItems
    );

    // Save recommendations to database
    for (const recipe of recommendedRecipes) {
      db.run(`
        INSERT OR IGNORE INTO recipe_recommendations (user_id, recipe_id, reason)
        VALUES (?, ?, ?)
      `, [
        req.session.user.id,
        recipe.id,
        `Based on ingredients: ${fridgeItems.map(item => item.name).join(', ')}`
      ]);
    }

    res.json({
      recipes: recommendedRecipes,
      fridgeItems: fridgeItems
    });
  } catch (error) {
    console.error('Error getting recipe recommendations:', error);
    res.status(500).json({ error: 'Fout bij het ophalen van receptaanbevelingen' });
  }
});

// Get recipe details
router.get('/:id', (req, res) => {
  const { id } = req.params;

  db.get('SELECT * FROM recipes WHERE id = ?', [id], (err, recipe) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    if (!recipe) {
      return res.status(404).json({ error: 'Recept niet gevonden' });
    }

    // Parse JSON fields
    try {
      recipe.ingredients = JSON.parse(recipe.ingredients || '[]');
      recipe.diet_type = JSON.parse(recipe.diet_type || '[]');
    } catch (e) {
      console.error('Error parsing recipe JSON:', e);
    }

    // Check if recipe is saved by user
    db.get('SELECT id FROM saved_recipes WHERE user_id = ? AND recipe_id = ?', 
      [req.session.user.id, id], (err, savedRecipe) => {
        if (err) {
          console.error('Error checking saved recipe:', err);
        }

        recipe.is_saved = !!savedRecipe;
        res.json(recipe);
      });
  });
});

// Save/unsave recipe
router.post('/:id/save', (req, res) => {
  const { id } = req.params;

  // Check if already saved
  db.get('SELECT id FROM saved_recipes WHERE user_id = ? AND recipe_id = ?', 
    [req.session.user.id, id], (err, savedRecipe) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      if (savedRecipe) {
        // Remove from saved
        db.run('DELETE FROM saved_recipes WHERE id = ?', [savedRecipe.id], (err) => {
          if (err) {
            return res.status(500).json({ error: 'Fout bij het verwijderen van opgeslagen recept' });
          }
          res.json({ saved: false, message: 'Recept verwijderd uit opgeslagen recepten' });
        });
      } else {
        // Add to saved
        db.run('INSERT INTO saved_recipes (user_id, recipe_id) VALUES (?, ?)', 
          [req.session.user.id, id], (err) => {
            if (err) {
              return res.status(500).json({ error: 'Fout bij het opslaan van recept' });
            }
            res.json({ saved: true, message: 'Recept opgeslagen' });
          });
      }
    });
});

// Rate recipe
router.post('/:id/rate', [
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating moet tussen 1 en 5 zijn'),
  body('feedback').optional().isString()
], (req, res) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      error: 'Ongeldige invoer',
      details: errors.array()
    });
  }

  const { id } = req.params;
  const { rating, feedback = '' } = req.body;

  // Find existing recommendation
  db.get(`
    SELECT id FROM recipe_recommendations 
    WHERE user_id = ? AND recipe_id = ?
    ORDER BY recommended_at DESC
    LIMIT 1
  `, [req.session.user.id, id], (err, recommendation) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    if (!recommendation) {
      return res.status(404).json({ error: 'Receptaanbeveling niet gevonden' });
    }

    // Update rating
    db.run(`
      UPDATE recipe_recommendations 
      SET user_rating = ?, user_feedback = ? 
      WHERE id = ?
    `, [rating, feedback, recommendation.id], (err) => {
      if (err) {
        return res.status(500).json({ error: 'Fout bij het opslaan van beoordeling' });
      }

      res.json({ message: 'Beoordeling opgeslagen', rating, feedback });
    });
  });
});

// Get saved recipes
router.get('/saved/list', (req, res) => {
  db.all(`
    SELECT r.*, sr.saved_at, sr.notes
    FROM saved_recipes sr
    JOIN recipes r ON sr.recipe_id = r.id
    WHERE sr.user_id = ?
    ORDER BY sr.saved_at DESC
  `, [req.session.user.id], (err, recipes) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    // Parse JSON fields
    recipes.forEach(recipe => {
      try {
        recipe.ingredients = JSON.parse(recipe.ingredients || '[]');
        recipe.diet_type = JSON.parse(recipe.diet_type || '[]');
      } catch (e) {
        console.error('Error parsing recipe JSON:', e);
      }
    });

    res.json(recipes);
  });
});

// Search recipes
router.get('/search', (req, res) => {
  const { q, cuisine, diet, difficulty } = req.query;
  
  let query = 'SELECT * FROM recipes WHERE 1=1';
  const params = [];

  if (q) {
    query += ' AND (title LIKE ? OR description LIKE ?)';
    params.push(`%${q}%`, `%${q}%`);
  }

  if (cuisine) {
    query += ' AND cuisine_type = ?';
    params.push(cuisine);
  }

  if (difficulty) {
    query += ' AND difficulty = ?';
    params.push(difficulty);
  }

  query += ' ORDER BY title LIMIT 20';

  db.all(query, params, (err, recipes) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    // Parse JSON fields
    recipes.forEach(recipe => {
      try {
        recipe.ingredients = JSON.parse(recipe.ingredients || '[]');
        recipe.diet_type = JSON.parse(recipe.diet_type || '[]');
      } catch (e) {
        console.error('Error parsing recipe JSON:', e);
      }
    });

    res.json(recipes);
  });
});

module.exports = router;
