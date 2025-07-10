const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = process.env.DATABASE_URL || path.join(__dirname, '..', 'database.sqlite');
const db = new sqlite3.Database(dbPath);

// Enable foreign keys
db.run('PRAGMA foreign_keys = ON');

const initializeDatabase = () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Users table
      db.run(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT UNIQUE NOT NULL,
          username TEXT,
          password_hash TEXT NOT NULL,
          privacy_accepted BOOLEAN DEFAULT 0,
          profile_completed BOOLEAN DEFAULT 0,
          email_verified BOOLEAN DEFAULT 0,
          verification_token TEXT,
          reset_token TEXT,
          reset_token_expires DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          last_login DATETIME
        )
      `);

      // User profiles table
      db.run(`
        CREATE TABLE IF NOT EXISTS user_profiles (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          cuisine_preferences TEXT, -- JSON array
          diet_preferences TEXT, -- JSON array
          allergies TEXT, -- JSON array
          dislikes TEXT,
          diet_goal TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
      `);

      // Fridge items table
      db.run(`
        CREATE TABLE IF NOT EXISTS fridge_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          name TEXT NOT NULL,
          quantity TEXT DEFAULT '1',
          expiry_date DATE,
          image_url TEXT,
          added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
          UNIQUE(user_id, name)
        )
      `);

      // Recipes table
      db.run(`
        CREATE TABLE IF NOT EXISTS recipes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          description TEXT,
          ingredients TEXT, -- JSON array
          instructions TEXT,
          prep_time INTEGER,
          cook_time INTEGER,
          servings INTEGER DEFAULT 4,
          difficulty TEXT DEFAULT 'medium',
          cuisine_type TEXT,
          diet_type TEXT, -- JSON array
          image_url TEXT,
          source_url TEXT,
          spoonacular_id INTEGER UNIQUE,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Recipe recommendations table
      db.run(`
        CREATE TABLE IF NOT EXISTS recipe_recommendations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          recipe_id INTEGER NOT NULL,
          recommended_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          reason TEXT,
          user_rating INTEGER,
          user_feedback TEXT,
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
          FOREIGN KEY (recipe_id) REFERENCES recipes (id) ON DELETE CASCADE
        )
      `);

      // Saved recipes table
      db.run(`
        CREATE TABLE IF NOT EXISTS saved_recipes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          recipe_id INTEGER NOT NULL,
          saved_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          notes TEXT,
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
          FOREIGN KEY (recipe_id) REFERENCES recipes (id) ON DELETE CASCADE,
          UNIQUE(user_id, recipe_id)
        )
      `);

      // AH Bonus items table
      db.run(`
        CREATE TABLE IF NOT EXISTS ah_bonus_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          description TEXT,
          original_price DECIMAL(10,2),
          bonus_price DECIMAL(10,2),
          discount_percentage INTEGER,
          category TEXT,
          brand TEXT,
          image_url TEXT,
          valid_from DATE,
          valid_until DATE,
          ah_product_id TEXT UNIQUE,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Shopping lists table
      db.run(`
        CREATE TABLE IF NOT EXISTS shopping_lists (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          name TEXT DEFAULT 'Boodschappenlijst',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
      `);

      // Shopping list items table
      db.run(`
        CREATE TABLE IF NOT EXISTS shopping_list_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          shopping_list_id INTEGER NOT NULL,
          name TEXT NOT NULL,
          quantity TEXT DEFAULT '1',
          is_purchased BOOLEAN DEFAULT 0,
          ah_bonus_item_id INTEGER,
          estimated_price DECIMAL(10,2),
          notes TEXT,
          added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (shopping_list_id) REFERENCES shopping_lists (id) ON DELETE CASCADE,
          FOREIGN KEY (ah_bonus_item_id) REFERENCES ah_bonus_items (id) ON DELETE SET NULL
        )
      `);

      // Recipe shopping lists table
      db.run(`
        CREATE TABLE IF NOT EXISTS recipe_shopping_lists (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          recipe_id INTEGER NOT NULL,
          shopping_list_id INTEGER NOT NULL,
          missing_ingredients TEXT, -- JSON array
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
          FOREIGN KEY (recipe_id) REFERENCES recipes (id) ON DELETE CASCADE,
          FOREIGN KEY (shopping_list_id) REFERENCES shopping_lists (id) ON DELETE CASCADE
        )
      `);

      // Admin users table
      db.run(`
        CREATE TABLE IF NOT EXISTS admin_users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          two_factor_enabled BOOLEAN DEFAULT 0,
          backup_tokens TEXT, -- JSON array
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
      `);

      // Admin activity table
      db.run(`
        CREATE TABLE IF NOT EXISTS admin_activity (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          admin_user_id INTEGER NOT NULL,
          action TEXT NOT NULL,
          description TEXT,
          ip_address TEXT,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (admin_user_id) REFERENCES users (id) ON DELETE CASCADE
        )
      `);

      // Create default admin user if it doesn't exist
      const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
      const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
      
      db.get('SELECT id FROM users WHERE email = ?', [adminEmail], (err, row) => {
        if (err) {
          console.error('Error checking for admin user:', err);
          return;
        }
        
        if (!row) {
          const bcrypt = require('bcryptjs');
          const hashedPassword = bcrypt.hashSync(adminPassword, 12);
          
          db.run(`
            INSERT INTO users (email, username, password_hash, privacy_accepted, profile_completed, email_verified)
            VALUES (?, ?, ?, 1, 1, 1)
          `, [adminEmail, 'admin', hashedPassword], function(err) {
            if (err) {
              console.error('Error creating admin user:', err);
              return;
            }
            
            // Create admin profile
            db.run(`
              INSERT INTO admin_users (user_id, two_factor_enabled)
              VALUES (?, 0)
            `, [this.lastID], (err) => {
              if (err) {
                console.error('Error creating admin profile:', err);
              } else {
                console.log(`Admin user created: ${adminEmail}`);
              }
            });
          });
        }
      });

      resolve();
    });
  });
};

module.exports = { db, initializeDatabase };