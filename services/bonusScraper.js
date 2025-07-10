const axios = require('axios');
const cheerio = require('cheerio');
const cron = require('node-cron');
const { db } = require('../config/database');

class AHBonusScraper {
  constructor() {
    this.baseUrl = 'https://www.ah.nl';
    this.bonusUrl = `${this.baseUrl}/bonus`;
    this.headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    };
  }

  async scrapeBonusItems() {
    try {
      console.log('Starting AH bonus scraping...');
      
      // For demo purposes, we'll create some mock bonus items
      // In production, you would implement actual scraping logic
      const mockBonusItems = [
        {
          name: 'AH Biologische Bananen',
          description: 'Verse biologische bananen per kilo',
          original_price: 2.49,
          bonus_price: 1.99,
          discount_percentage: 20,
          category: 'Fruit',
          brand: 'AH',
          image_url: 'https://images.pexels.com/photos/2872755/pexels-photo-2872755.jpeg',
          valid_from: new Date().toISOString().split('T')[0],
          valid_until: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          ah_product_id: 'ah_bananas_001'
        },
        {
          name: 'AH Kip Filet',
          description: 'Verse kipfilet per 500g',
          original_price: 4.99,
          bonus_price: 3.99,
          discount_percentage: 20,
          category: 'Vlees',
          brand: 'AH',
          image_url: 'https://images.pexels.com/photos/616354/pexels-photo-616354.jpeg',
          valid_from: new Date().toISOString().split('T')[0],
          valid_until: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          ah_product_id: 'ah_chicken_001'
        },
        {
          name: 'AH Pasta Penne',
          description: 'Penne pasta 500g',
          original_price: 1.29,
          bonus_price: 0.99,
          discount_percentage: 23,
          category: 'Pasta',
          brand: 'AH',
          image_url: 'https://images.pexels.com/photos/1437267/pexels-photo-1437267.jpeg',
          valid_from: new Date().toISOString().split('T')[0],
          valid_until: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          ah_product_id: 'ah_pasta_001'
        },
        {
          name: 'AH Tomaten Cherry',
          description: 'Verse cherry tomaten 250g',
          original_price: 1.99,
          bonus_price: 1.49,
          discount_percentage: 25,
          category: 'Groenten',
          brand: 'AH',
          image_url: 'https://images.pexels.com/photos/533280/pexels-photo-533280.jpeg',
          valid_from: new Date().toISOString().split('T')[0],
          valid_until: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          ah_product_id: 'ah_tomatoes_001'
        },
        {
          name: 'AH Kaas Belegen',
          description: 'Belegen kaas per 200g',
          original_price: 3.49,
          bonus_price: 2.79,
          discount_percentage: 20,
          category: 'Zuivel',
          brand: 'AH',
          image_url: 'https://images.pexels.com/photos/773253/pexels-photo-773253.jpeg',
          valid_from: new Date().toISOString().split('T')[0],
          valid_until: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          ah_product_id: 'ah_cheese_001'
        }
      ];

      return mockBonusItems;

      // Actual scraping implementation would look like this:
      /*
      const response = await axios.get(this.bonusUrl, { headers: this.headers });
      const $ = cheerio.load(response.data);
      
      const bonusItems = [];
      
      $('.product-card').each((index, element) => {
        try {
          const $el = $(element);
          const name = $el.find('.product-title').text().trim();
          const originalPrice = parseFloat($el.find('.original-price').text().replace('€', '').replace(',', '.'));
          const bonusPrice = parseFloat($el.find('.bonus-price').text().replace('€', '').replace(',', '.'));
          const discountPercentage = Math.round(((originalPrice - bonusPrice) / originalPrice) * 100);
          const imageUrl = $el.find('img').attr('src');
          const productId = $el.attr('data-product-id');
          
          bonusItems.push({
            name,
            original_price: originalPrice,
            bonus_price: bonusPrice,
            discount_percentage: discountPercentage,
            image_url: imageUrl,
            ah_product_id: productId,
            valid_from: new Date().toISOString().split('T')[0],
            valid_until: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
          });
        } catch (error) {
          console.error('Error parsing product:', error);
        }
      });
      
      return bonusItems;
      */
    } catch (error) {
      console.error('Error scraping AH bonus items:', error);
      return [];
    }
  }

  async updateDatabase() {
    try {
      const bonusItems = await this.scrapeBonusItems();
      
      if (bonusItems.length === 0) {
        console.log('No bonus items found');
        return 0;
      }

      // Clear old bonus items
      db.run('DELETE FROM ah_bonus_items WHERE valid_until < date("now")', (err) => {
        if (err) {
          console.error('Error clearing old bonus items:', err);
        }
      });

      // Add new bonus items
      let addedCount = 0;
      
      for (const item of bonusItems) {
        await new Promise((resolve, reject) => {
          db.run(`
            INSERT OR REPLACE INTO ah_bonus_items 
            (name, description, original_price, bonus_price, discount_percentage, 
             category, brand, image_url, valid_from, valid_until, ah_product_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            item.name,
            item.description || '',
            item.original_price,
            item.bonus_price,
            item.discount_percentage,
            item.category || '',
            item.brand || '',
            item.image_url || '',
            item.valid_from,
            item.valid_until,
            item.ah_product_id
          ], function(err) {
            if (err) {
              console.error('Error inserting bonus item:', err);
              reject(err);
            } else {
              addedCount++;
              resolve();
            }
          });
        });
      }

      console.log(`Updated ${addedCount} bonus items`);
      return addedCount;
    } catch (error) {
      console.error('Error updating bonus database:', error);
      return 0;
    }
  }
}

// Initialize scraper
const scraper = new AHBonusScraper();

// Function to start the bonus scraper cron job
function startBonusScraper() {
  // Run every Monday at 6 AM
  cron.schedule('0 6 * * 1', async () => {
    console.log('Running scheduled AH bonus scraper...');
    await scraper.updateDatabase();
  });

  // Run once on startup for demo purposes
  setTimeout(async () => {
    console.log('Running initial AH bonus scraper...');
    await scraper.updateDatabase();
  }, 5000);
}

// Export functions
module.exports = {
  AHBonusScraper,
  startBonusScraper,
  updateBonusCache: () => scraper.updateDatabase()
};
