const express = require('express');
const { body, validationResult } = require('express-validator');
const { db } = require('../config/database');
const { requireAuth, requireCompleteProfile } = require('../middleware/auth');

const router = express.Router();

// Apply auth middleware
router.use(requireAuth);
router.use(requireCompleteProfile);

// Get all fridge items for user
router.get('/', (req, res) => {
  db.all(`
    SELECT * FROM fridge_items 
    WHERE user_id = ? 
    ORDER BY added_at DESC
  `, [req.session.user.id], (err, items) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(items);
  });
});

// Add fridge item
router.post('/', [
  body('name').trim().isLength({ min: 1 }).withMessage('Naam is verplicht'),
  body('quantity').optional().trim(),
  body('expiryDate').optional().isISO8601()
], (req, res) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      error: 'Ongeldige invoer',
      details: errors.array()
    });
  }

  const { name, quantity = '1', expiryDate } = req.body;

  db.run(`
    INSERT OR REPLACE INTO fridge_items (user_id, name, quantity, expiry_date)
    VALUES (?, ?, ?, ?)
  `, [req.session.user.id, name, quantity, expiryDate || null], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Fout bij het toevoegen van item' });
    }

    // Get the inserted/updated item
    db.get('SELECT * FROM fridge_items WHERE id = ?', [this.lastID], (err, item) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      res.json({ message: 'Item toegevoegd', item });
    });
  });
});

// Update fridge item
router.put('/:id', [
  body('name').optional().trim().isLength({ min: 1 }),
  body('quantity').optional().trim(),
  body('expiryDate').optional().isISO8601()
], (req, res) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      error: 'Ongeldige invoer',
      details: errors.array()
    });
  }

  const { id } = req.params;
  const { name, quantity, expiryDate } = req.body;

  // Build dynamic update query
  const updates = [];
  const values = [];

  if (name !== undefined) {
    updates.push('name = ?');
    values.push(name);
  }
  if (quantity !== undefined) {
    updates.push('quantity = ?');
    values.push(quantity);
  }
  if (expiryDate !== undefined) {
    updates.push('expiry_date = ?');
    values.push(expiryDate || null);
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'Geen velden om bij te werken' });
  }

  values.push(req.session.user.id, id);

  db.run(`
    UPDATE fridge_items 
    SET ${updates.join(', ')} 
    WHERE user_id = ? AND id = ?
  `, values, function(err) {
    if (err) {
      return res.status(500).json({ error: 'Fout bij het bijwerken van item' });
    }

    if (this.changes === 0) {
      return res.status(404).json({ error: 'Item niet gevonden' });
    }

    res.json({ message: 'Item bijgewerkt' });
  });
});

// Delete fridge item
router.delete('/:id', (req, res) => {
  const { id } = req.params;

  db.run(`
    DELETE FROM fridge_items 
    WHERE user_id = ? AND id = ?
  `, [req.session.user.id, id], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Fout bij het verwijderen van item' });
    }

    if (this.changes === 0) {
      return res.status(404).json({ error: 'Item niet gevonden' });
    }

    res.json({ message: 'Item verwijderd' });
  });
});

// Get ingredient suggestions (for autocomplete)
router.get('/suggestions', (req, res) => {
  const { q } = req.query;
  
  if (!q || q.length < 2) {
    return res.json([]);
  }

  // Common ingredients list for suggestions
  const commonIngredients = [
    'Aardappelen', 'Uien', 'Knoflook', 'Tomaten', 'Paprika', 'Courgette',
    'Wortel', 'Broccoli', 'Spinazie', 'Sla', 'Komkommer', 'Champignons',
    'Kip', 'Rundvlees', 'Varkensvlees', 'Vis', 'Zalm', 'Garnalen',
    'Eieren', 'Melk', 'Kaas', 'Yoghurt', 'Boter', 'Room',
    'Rijst', 'Pasta', 'Brood', 'Bloem', 'Suiker', 'Zout', 'Peper',
    'Olijfolie', 'Azijn', 'Basilicum', 'Peterselie', 'Oregano'
  ];

  const suggestions = commonIngredients
    .filter(ingredient => 
      ingredient.toLowerCase().includes(q.toLowerCase())
    )
    .slice(0, 10);

  res.json(suggestions);
});

module.exports = router;