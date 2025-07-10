const express = require('express');
const { body, validationResult } = require('express-validator');
const { db } = require('../config/database');
const { requireAuth, requireCompleteProfile } = require('../middleware/auth');

const router = express.Router();

// Apply auth middleware
router.use(requireAuth);
router.use(requireCompleteProfile);

// Get user's shopping lists
router.get('/lists', (req, res) => {
  db.all(`
    SELECT sl.*, COUNT(sli.id) as item_count,
           COUNT(CASE WHEN sli.is_purchased = 1 THEN 1 END) as purchased_count
    FROM shopping_lists sl
    LEFT JOIN shopping_list_items sli ON sl.id = sli.shopping_list_id
    WHERE sl.user_id = ?
    GROUP BY sl.id
    ORDER BY sl.created_at DESC
  `, [req.session.user.id], (err, lists) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(lists);
  });
});

// Get shopping list details
router.get('/lists/:id', (req, res) => {
  const { id } = req.params;

  // Get shopping list
  db.get('SELECT * FROM shopping_lists WHERE id = ? AND user_id = ?', 
    [id, req.session.user.id], (err, list) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      if (!list) {
        return res.status(404).json({ error: 'Boodschappenlijst niet gevonden' });
      }

      // Get items
      db.all(`
        SELECT sli.*, abi.name as bonus_name, abi.bonus_price, abi.original_price, abi.discount_percentage
        FROM shopping_list_items sli
        LEFT JOIN ah_bonus_items abi ON sli.ah_bonus_item_id = abi.id
        WHERE sli.shopping_list_id = ?
        ORDER BY sli.is_purchased, sli.added_at
      `, [id], (err, items) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }

        res.json({
          list,
          items
        });
      });
    });
});

// Create shopping list from recipe
router.post('/lists/from-recipe/:recipeId', (req, res) => {
  const { recipeId } = req.params;

  // Get recipe
  db.get('SELECT * FROM recipes WHERE id = ?', [recipeId], (err, recipe) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    if (!recipe) {
      return res.status(404).json({ error: 'Recept niet gevonden' });
    }

    // Get user's fridge items
    db.all('SELECT name FROM fridge_items WHERE user_id = ?', [req.session.user.id], (err, fridgeItems) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      const fridgeItemNames = fridgeItems.map(item => item.name.toLowerCase());
      let recipeIngredients;

      try {
        recipeIngredients = JSON.parse(recipe.ingredients || '[]');
      } catch (e) {
        recipeIngredients = [];
      }

      // Find missing ingredients
      const missingIngredients = recipeIngredients.filter(ingredient => {
        const ingredientName = ingredient.toLowerCase();
        return !fridgeItemNames.some(fridgeItem => 
          fridgeItem.includes(ingredientName) || ingredientName.includes(fridgeItem)
        );
      });

      // Create shopping list
      db.run(`
        INSERT INTO shopping_lists (user_id, name)
        VALUES (?, ?)
      `, [req.session.user.id, `Boodschappen voor ${recipe.title}`], function(err) {
        if (err) {
          return res.status(500).json({ error: 'Fout bij het aanmaken van boodschappenlijst' });
        }

        const shoppingListId = this.lastID;

        // Add missing ingredients to shopping list
        const addItemPromises = missingIngredients.map(ingredient => {
          return new Promise((resolve, reject) => {
            // Try to find matching bonus item
            db.get(`
              SELECT id, bonus_price FROM ah_bonus_items 
              WHERE name LIKE ? AND valid_until >= date('now')
              ORDER BY discount_percentage DESC
              LIMIT 1
            `, [`%${ingredient.split(' ')[0]}%`], (err, bonusItem) => {
              if (err) {
                reject(err);
                return;
              }

              db.run(`
                INSERT INTO shopping_list_items (shopping_list_id, name, ah_bonus_item_id, estimated_price)
                VALUES (?, ?, ?, ?)
              `, [
                shoppingListId,
                ingredient,
                bonusItem ? bonusItem.id : null,
                bonusItem ? bonusItem.bonus_price : null
              ], (err) => {
                if (err) reject(err);
                else resolve();
              });
            });
          });
        });

        Promise.all(addItemPromises)
          .then(() => {
            // Create recipe shopping list record
            db.run(`
              INSERT INTO recipe_shopping_lists (user_id, recipe_id, shopping_list_id, missing_ingredients)
              VALUES (?, ?, ?, ?)
            `, [
              req.session.user.id,
              recipeId,
              shoppingListId,
              JSON.stringify(missingIngredients)
            ], (err) => {
              if (err) {
                console.error('Error creating recipe shopping list record:', err);
              }

              res.json({
                message: 'Boodschappenlijst aangemaakt',
                shoppingListId,
                missingIngredients: missingIngredients.length
              });
            });
          })
          .catch(err => {
            console.error('Error adding items to shopping list:', err);
            res.status(500).json({ error: 'Fout bij het toevoegen van items' });
          });
      });
    });
  });
});

// Toggle item purchased status
router.put('/items/:id/toggle', (req, res) => {
  const { id } = req.params;

  // Verify item belongs to user
  db.get(`
    SELECT sli.id, sli.is_purchased
    FROM shopping_list_items sli
    JOIN shopping_lists sl ON sli.shopping_list_id = sl.id
    WHERE sli.id = ? AND sl.user_id = ?
  `, [id, req.session.user.id], (err, item) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    if (!item) {
      return res.status(404).json({ error: 'Item niet gevonden' });
    }

    const newStatus = !item.is_purchased;

    db.run('UPDATE shopping_list_items SET is_purchased = ? WHERE id = ?', 
      [newStatus, id], (err) => {
        if (err) {
          return res.status(500).json({ error: 'Fout bij het bijwerken van item' });
        }

        res.json({ 
          is_purchased: newStatus,
          message: newStatus ? 'Item afgevinkt' : 'Item niet afgevinkt'
        });
      });
  });
});

// Get AH bonus recommendations
router.get('/bonus-recommendations', (req, res) => {
  // Get user profile for filtering
  db.get('SELECT * FROM user_profiles WHERE user_id = ?', [req.session.user.id], (err, profile) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    let query = `
      SELECT * FROM ah_bonus_items 
      WHERE valid_until >= date('now')
      ORDER BY discount_percentage DESC
      LIMIT 20
    `;

    db.all(query, [], (err, bonusItems) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      // Filter based on user preferences if profile exists
      if (profile) {
        try {
          const dietPreferences = JSON.parse(profile.diet_preferences || '[]');
          const allergies = JSON.parse(profile.allergies || '[]');
          const dislikes = profile.dislikes ? profile.dislikes.split(',').map(d => d.trim().toLowerCase()) : [];

          bonusItems = bonusItems.filter(item => {
            const itemName = item.name.toLowerCase();

            // Filter out items that conflict with diet preferences
            if (dietPreferences.includes('vegan')) {
              const nonVeganKeywords = ['vlees', 'kip', 'vis', 'kaas', 'melk', 'ei', 'boter'];
              if (nonVeganKeywords.some(keyword => itemName.includes(keyword))) {
                return false;
              }
            }

            if (dietPreferences.includes('vegetarian')) {
              const meatKeywords = ['vlees', 'kip', 'vis', 'ham', 'spek'];
              if (meatKeywords.some(keyword => itemName.includes(keyword))) {
                return false;
              }
            }

            // Filter out allergens
            const allergenKeywords = {
              'nuts': ['noot', 'amandel', 'hazelnoot', 'pinda'],
              'gluten': ['tarwe', 'rogge', 'gerst', 'haver'],
              'lactose': ['melk', 'kaas', 'yoghurt', 'room'],
              'fish': ['vis', 'zalm', 'tonijn'],
              'shellfish': ['garnaal', 'kreeft', 'mosselen'],
              'eggs': ['ei'],
              'soy': ['soja']
            };

            for (const allergy of allergies) {
              const keywords = allergenKeywords[allergy] || [];
              if (keywords.some(keyword => itemName.includes(keyword))) {
                return false;
              }
            }

            // Filter out dislikes
            if (dislikes.some(dislike => itemName.includes(dislike))) {
              return false;
            }

            return true;
          });
        } catch (e) {
          console.error('Error filtering bonus items:', e);
        }
      }

      res.json(bonusItems);
    });
  });
});

// Add bonus item to shopping list
router.post('/add-bonus', [
  body('bonusItemId').isInt().withMessage('Bonus item ID is verplicht'),
  body('shoppingListId').optional().isInt()
], (req, res) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      error: 'Ongeldige invoer',
      details: errors.array()
    });
  }

  const { bonusItemId, shoppingListId } = req.body;

  // Get bonus item
  db.get('SELECT * FROM ah_bonus_items WHERE id = ?', [bonusItemId], (err, bonusItem) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    if (!bonusItem) {
      return res.status(404).json({ error: 'Bonus item niet gevonden' });
    }

    const addToList = (listId) => {
      // Check if item already exists in list
      db.get('SELECT id FROM shopping_list_items WHERE shopping_list_id = ? AND name = ?', 
        [listId, bonusItem.name], (err, existingItem) => {
          if (err) {
            return res.status(500).json({ error: 'Database error' });
          }

          if (existingItem) {
            return res.status(400).json({ error: 'Item staat al in de boodschappenlijst' });
          }

          // Add item to shopping list
          db.run(`
            INSERT INTO shopping_list_items (shopping_list_id, name, ah_bonus_item_id, estimated_price)
            VALUES (?, ?, ?, ?)
          `, [listId, bonusItem.name, bonusItemId, bonusItem.bonus_price], (err) => {
            if (err) {
              return res.status(500).json({ error: 'Fout bij het toevoegen van item' });
            }

            res.json({ 
              message: 'Item toegevoegd aan boodschappenlijst',
              shoppingListId: listId
            });
          });
        });
    };

    if (shoppingListId) {
      // Verify shopping list belongs to user
      db.get('SELECT id FROM shopping_lists WHERE id = ? AND user_id = ?', 
        [shoppingListId, req.session.user.id], (err, list) => {
          if (err) {
            return res.status(500).json({ error: 'Database error' });
          }

          if (!list) {
            return res.status(404).json({ error: 'Boodschappenlijst niet gevonden' });
          }

          addToList(shoppingListId);
        });
    } else {
      // Create or get default shopping list
      db.get('SELECT id FROM shopping_lists WHERE user_id = ? AND name = ?', 
        [req.session.user.id, 'Mijn Boodschappenlijst'], (err, list) => {
          if (err) {
            return res.status(500).json({ error: 'Database error' });
          }

          if (list) {
            addToList(list.id);
          } else {
            // Create default list
            db.run('INSERT INTO shopping_lists (user_id, name) VALUES (?, ?)', 
              [req.session.user.id, 'Mijn Boodschappenlijst'], function(err) {
                if (err) {
                  return res.status(500).json({ error: 'Fout bij het aanmaken van boodschappenlijst' });
                }

                addToList(this.lastID);
              });
          }
        });
    }
  });
});

module.exports = router;
