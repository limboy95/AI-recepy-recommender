const axios = require('axios');
const OpenAI = require('openai');
const { db } = require('../config/database');

class SpoonacularService {
  constructor() {
    this.apiKey = process.env.SPOONACULAR_API_KEY;
    this.baseUrl = 'https://api.spoonacular.com/recipes';
  }

  async searchRecipes(ingredients, diet = null, cuisine = null, intolerances = null, number = 10) {
    if (!this.apiKey) {
      console.log('Spoonacular API key not configured, using mock data');
      return this.getMockRecipes(ingredients);
    }

    try {
      const params = {
        apiKey: this.apiKey,
        ingredients: ingredients.join(','),
        number,
        ranking: 2,
        ignorePantry: true
      };

      if (diet) params.diet = diet;
      if (cuisine) params.cuisine = cuisine;
      if (intolerances) params.intolerances = intolerances.join(',');

      const response = await axios.get(`${this.baseUrl}/findByIngredients`, { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching recipes from Spoonacular:', error);
      return this.getMockRecipes(ingredients);
    }
  }

  async getRecipeDetails(recipeId) {
    if (!this.apiKey) {
      return this.getMockRecipeDetails(recipeId);
    }

    try {
      const params = {
        apiKey: this.apiKey,
        includeNutrition: false
      };

      const response = await axios.get(`${this.baseUrl}/${recipeId}/information`, { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching recipe details:', error);
      return this.getMockRecipeDetails(recipeId);
    }
  }

  getMockRecipes(ingredients) {
    // Mock recipes based on common ingredients
    const mockRecipes = [
      {
        id: 1001,
        title: 'Pasta met Tomaten en Basilicum',
        image: 'https://images.pexels.com/photos/1437267/pexels-photo-1437267.jpeg',
        usedIngredientCount: ingredients.filter(ing => 
          ['pasta', 'tomaten', 'basilicum', 'knoflook'].some(common => 
            ing.toLowerCase().includes(common)
          )
        ).length,
        missedIngredientCount: 2
      },
      {
        id: 1002,
        title: 'Kip met Groenten',
        image: 'https://images.pexels.com/photos/616354/pexels-photo-616354.jpeg',
        usedIngredientCount: ingredients.filter(ing => 
          ['kip', 'paprika', 'ui', 'wortel'].some(common => 
            ing.toLowerCase().includes(common)
          )
        ).length,
        missedIngredientCount: 1
      },
      {
        id: 1003,
        title: 'Groente Roerbak',
        image: 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg',
        usedIngredientCount: ingredients.filter(ing => 
          ['broccoli', 'paprika', 'ui', 'knoflook'].some(common => 
            ing.toLowerCase().includes(common)
          )
        ).length,
        missedIngredientCount: 2
      }
    ];

    return mockRecipes.slice(0, 3);
  }

  getMockRecipeDetails(recipeId) {
    const mockDetails = {
      1001: {
        id: 1001,
        title: 'Pasta met Tomaten en Basilicum',
        summary: 'Een heerlijke en eenvoudige pasta met verse tomaten en basilicum.',
        extendedIngredients: [
          { original: '400g pasta' },
          { original: '4 grote tomaten' },
          { original: '2 tenen knoflook' },
          { original: 'Verse basilicum' },
          { original: 'Olijfolie' },
          { original: 'Zout en peper' }
        ],
        instructions: `
          1. Kook de pasta volgens de verpakking.
          2. Verhit olijfolie in een pan en bak de knoflook.
          3. Voeg de tomaten toe en laat 10 minuten sudderen.
          4. Meng de pasta door de saus.
          5. Garneer met verse basilicum.
        `,
        preparationMinutes: 15,
        cookingMinutes: 20,
        servings: 4,
        image: 'https://images.pexels.com/photos/1437267/pexels-photo-1437267.jpeg'
      },
      1002: {
        id: 1002,
        title: 'Kip met Groenten',
        summary: 'Sappige kip met kleurrijke groenten, perfect voor een gezonde maaltijd.',
        extendedIngredients: [
          { original: '500g kipfilet' },
          { original: '1 rode paprika' },
          { original: '1 ui' },
          { original: '2 wortels' },
          { original: 'Olijfolie' },
          { original: 'Kruiden naar smaak' }
        ],
        instructions: `
          1. Snijd de kip en groenten in stukken.
          2. Verhit olie in een pan en bak de kip gaar.
          3. Voeg de groenten toe en roerbak 10 minuten.
          4. Kruid naar smaak en serveer.
        `,
        preparationMinutes: 20,
        cookingMinutes: 25,
        servings: 4,
        image: 'https://images.pexels.com/photos/616354/pexels-photo-616354.jpeg'
      },
      1003: {
        id: 1003,
        title: 'Groente Roerbak',
        summary: 'Kleurrijke groenten snel geroerbakt voor een gezonde maaltijd.',
        extendedIngredients: [
          { original: '200g broccoli' },
          { original: '1 rode paprika' },
          { original: '1 ui' },
          { original: '2 tenen knoflook' },
          { original: 'Sojasaus' },
          { original: 'Sesamolie' }
        ],
        instructions: `
          1. Snijd alle groenten in gelijke stukken.
          2. Verhit olie in een wok of grote pan.
          3. Roerbak de groenten 5-7 minuten.
          4. Voeg sojasaus toe en meng goed.
          5. Serveer direct.
        `,
        preparationMinutes: 10,
        cookingMinutes: 10,
        servings: 2,
        image: 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg'
      }
    };

    return mockDetails[recipeId] || null;
  }
}

class AIRecipeService {
  constructor() {
    this.openai = process.env.OPENAI_API_KEY ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    }) : null;
  }

  async generateRecipe(ingredients, preferences, allergies, dislikes) {
    if (!this.openai) {
      console.log('OpenAI API key not configured, using fallback recipe');
      return this.getFallbackRecipe(ingredients);
    }

    const prompt = `
      Maak een recept met de volgende ingrediënten: ${ingredients.join(', ')}
      
      Voorkeuren: ${preferences.cuisine?.join(', ') || 'geen'} keuken, ${preferences.diet?.join(', ') || 'geen'} dieet
      Allergieën: ${allergies?.join(', ') || 'geen'}
      Niet lekker: ${dislikes || 'geen'}
      
      Geef het recept terug in JSON formaat met:
      - title: titel van het recept
      - description: korte beschrijving
      - ingredients: array van ingrediënten met hoeveelheden
      - instructions: stap-voor-stap instructies
      - prep_time: voorbereidingstijd in minuten
      - cook_time: kooktijd in minuten
      - servings: aantal porties
      - difficulty: easy/medium/hard
    `;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'Je bent een ervaren kok die recepten maakt op basis van beschikbare ingrediënten en voorkeuren. Antwoord alleen met geldige JSON.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 1000,
        temperature: 0.7
      });

      const recipeText = response.choices[0].message.content;
      const recipeData = JSON.parse(recipeText);

      return this.saveGeneratedRecipe(recipeData);
    } catch (error) {
      console.error('Error generating AI recipe:', error);
      return this.getFallbackRecipe(ingredients);
    }
  }

  getFallbackRecipe(ingredients) {
    return {
      title: `Creatief Gerecht met ${ingredients.slice(0, 2).join(' en ')}`,
      description: 'Een eenvoudig en lekker gerecht gemaakt met je beschikbare ingrediënten.',
      ingredients: ingredients.map(ing => `1 portie ${ing}`),
      instructions: `
        1. Bereid alle ingrediënten voor door ze te wassen en te snijden.
        2. Verhit een pan met een beetje olie.
        3. Voeg de ingrediënten toe in volgorde van kooktijd.
        4. Kruid naar smaak met zout, peper en kruiden.
        5. Laat alles goed gaar worden en serveer warm.
      `,
      prep_time: 15,
      cook_time: 20,
      servings: 2,
      difficulty: 'easy',
      image_url: 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg'
    };
  }

  async saveGeneratedRecipe(recipeData) {
    return new Promise((resolve, reject) => {
      db.run(`
        INSERT INTO recipes (title, description, ingredients, instructions, prep_time, cook_time, servings, difficulty, source_url)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        recipeData.title,
        recipeData.description,
        JSON.stringify(recipeData.ingredients),
        recipeData.instructions,
        recipeData.prep_time,
        recipeData.cook_time,
        recipeData.servings,
        recipeData.difficulty,
        'AI Generated'
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({
            id: this.lastID,
            ...recipeData
          });
        }
      });
    });
  }
}

class WeatherService {
  constructor() {
    this.apiKey = process.env.WEATHER_API_KEY;
    this.baseUrl = 'http://api.openweathermap.org/data/2.5/weather';
  }

  async getWeatherInfluence(city = 'Amsterdam') {
    if (!this.apiKey) {
      return 'neutral';
    }

    try {
      const params = {
        q: city,
        appid: this.apiKey,
        units: 'metric'
      };

      const response = await axios.get(this.baseUrl, { params });
      const data = response.data;

      const temp = data.main.temp;
      const weather = data.weather[0].main.toLowerCase();

      if (temp < 10 || ['rain', 'snow'].includes(weather)) {
        return 'warm';
      } else if (temp > 25) {
        return 'cold';
      } else {
        return 'neutral';
      }
    } catch (error) {
      console.error('Error fetching weather data:', error);
      return 'neutral';
    }
  }
}

class RecipeRecommendationService {
  constructor() {
    this.spoonacular = new SpoonacularService();
    this.aiService = new AIRecipeService();
    this.weatherService = new WeatherService();
  }

  async getRecommendations(userId, fridgeItems, ahBonusItems = []) {
    try {
      // Get user profile
      const profile = await this.getUserProfile(userId);
      const ingredients = fridgeItems.map(item => item.name);

      // Get weather influence
      const weatherInfluence = await this.weatherService.getWeatherInfluence();

      const recipes = [];
      const cuisinePreferences = profile?.cuisine_preferences ? JSON.parse(profile.cuisine_preferences) : [];
      const dietPreferences = profile?.diet_preferences ? JSON.parse(profile.diet_preferences) : [];
      const allergies = profile?.allergies ? JSON.parse(profile.allergies) : [];

      // Try Spoonacular first
      for (const cuisine of cuisinePreferences.slice(0, 2)) {
        const spoonRecipes = await this.spoonacular.searchRecipes(
          ingredients,
          dietPreferences[0],
          cuisine,
          allergies,
          3
        );

        for (const recipeData of spoonRecipes) {
          const detailedRecipe = await this.spoonacular.getRecipeDetails(recipeData.id);
          if (detailedRecipe) {
            const recipe = await this.saveOrUpdateRecipe(detailedRecipe, cuisine);
            if (recipe) recipes.push(recipe);
          }
        }
      }

      // If no recipes found, try AI generation
      if (recipes.length === 0) {
        const aiRecipe = await this.aiService.generateRecipe(
          ingredients,
          {
            cuisine: cuisinePreferences,
            diet: dietPreferences
          },
          allergies,
          profile?.dislikes
        );
        if (aiRecipe) recipes.push(aiRecipe);
      }

      return recipes.slice(0, 5);
    } catch (error) {
      console.error('Error getting recipe recommendations:', error);
      return [];
    }
  }

  async getUserProfile(userId) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM user_profiles WHERE user_id = ?', [userId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  async saveOrUpdateRecipe(detailedRecipe, cuisine) {
    return new Promise((resolve, reject) => {
      db.get('SELECT id FROM recipes WHERE spoonacular_id = ?', [detailedRecipe.id], (err, row) => {
        if (err) {
          reject(err);
          return;
        }

        if (row) {
          // Recipe already exists
          resolve({ id: row.id, ...detailedRecipe });
          return;
        }

        // Create new recipe
        db.run(`
          INSERT INTO recipes (title, description, ingredients, instructions, prep_time, cook_time, servings, difficulty, cuisine_type, image_url, source_url, spoonacular_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          detailedRecipe.title,
          detailedRecipe.summary?.replace(/<[^>]*>/g, '') || '',
          JSON.stringify(detailedRecipe.extendedIngredients?.map(ing => ing.original) || []),
          detailedRecipe.instructions || '',
          detailedRecipe.preparationMinutes || 30,
          detailedRecipe.cookingMinutes || 30,
          detailedRecipe.servings || 4,
          'medium',
          cuisine,
          detailedRecipe.image || '',
          detailedRecipe.sourceUrl || '',
          detailedRecipe.id
        ], function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({
              id: this.lastID,
              title: detailedRecipe.title,
              description: detailedRecipe.summary?.replace(/<[^>]*>/g, '') || '',
              ingredients: detailedRecipe.extendedIngredients?.map(ing => ing.original) || [],
              instructions: detailedRecipe.instructions || '',
              prep_time: detailedRecipe.preparationMinutes || 30,
              cook_time: detailedRecipe.cookingMinutes || 30,
              servings: detailedRecipe.servings || 4,
              difficulty: 'medium',
              cuisine_type: cuisine,
              image_url: detailedRecipe.image || ''
            });
          }
        });
      });
    });
  }
}

module.exports = {
  SpoonacularService,
  AIRecipeService,
  WeatherService,
  RecipeRecommendationService
};
