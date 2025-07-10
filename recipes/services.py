import requests
import openai
from django.conf import settings
from .models import Recipe
import json

class SpoonacularService:
    def __init__(self):
        self.api_key = settings.SPOONACULAR_API_KEY
        self.base_url = "https://api.spoonacular.com/recipes"
    
    def search_recipes(self, ingredients, diet=None, cuisine=None, intolerances=None, number=10):
        """Search for recipes based on ingredients and preferences"""
        url = f"{self.base_url}/findByIngredients"
        params = {
            'apiKey': self.api_key,
            'ingredients': ','.join(ingredients),
            'number': number,
            'ranking': 2,  # Maximize used ingredients
            'ignorePantry': True
        }
        
        if diet:
            params['diet'] = diet
        if cuisine:
            params['cuisine'] = cuisine
        if intolerances:
            params['intolerances'] = ','.join(intolerances)
        
        try:
            response = requests.get(url, params=params)
            response.raise_for_status()
            return response.json()
        except requests.RequestException as e:
            print(f"Error fetching recipes from Spoonacular: {e}")
            return []
    
    def get_recipe_details(self, recipe_id):
        """Get detailed recipe information"""
        url = f"{self.base_url}/{recipe_id}/information"
        params = {
            'apiKey': self.api_key,
            'includeNutrition': False
        }
        
        try:
            response = requests.get(url, params=params)
            response.raise_for_status()
            return response.json()
        except requests.RequestException as e:
            print(f"Error fetching recipe details: {e}")
            return None

class AIRecipeService:
    def __init__(self):
        openai.api_key = settings.OPENAI_API_KEY
    
    def generate_recipe(self, ingredients, preferences, allergies, dislikes):
        """Generate a recipe using OpenAI when no suitable recipes are found"""
        
        # Build the prompt
        prompt = f"""
        Maak een recept met de volgende ingrediënten: {', '.join(ingredients)}
        
        Voorkeuren: {', '.join(preferences.get('cuisine', []))} keuken, {', '.join(preferences.get('diet', []))} dieet
        Allergieën: {', '.join(allergies)}
        Niet lekker: {dislikes}
        
        Geef het recept terug in JSON formaat met:
        - title: titel van het recept
        - description: korte beschrijving
        - ingredients: lijst van ingrediënten met hoeveelheden
        - instructions: stap-voor-stap instructies
        - prep_time: voorbereidingstijd in minuten
        - cook_time: kooktijd in minuten
        - servings: aantal porties
        - difficulty: easy/medium/hard
        """
        
        try:
            response = openai.ChatCompletion.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": "Je bent een ervaren kok die recepten maakt op basis van beschikbare ingrediënten en voorkeuren."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=1000,
                temperature=0.7
            )
            
            recipe_text = response.choices[0].message.content
            recipe_data = json.loads(recipe_text)
            
            # Create and save the recipe
            recipe = Recipe.objects.create(
                title=recipe_data['title'],
                description=recipe_data['description'],
                ingredients=recipe_data['ingredients'],
                instructions=recipe_data['instructions'],
                prep_time=recipe_data['prep_time'],
                cook_time=recipe_data['cook_time'],
                servings=recipe_data['servings'],
                difficulty=recipe_data['difficulty'],
                source_url='AI Generated'
            )
            
            return recipe
            
        except Exception as e:
            print(f"Error generating AI recipe: {e}")
            return None

class WeatherService:
    def __init__(self):
        self.api_key = settings.WEATHER_API_KEY
        self.base_url = "http://api.openweathermap.org/data/2.5/weather"
    
    def get_weather_influence(self, city="Amsterdam"):
        """Get weather data to influence recipe recommendations"""
        if not self.api_key:
            return None
            
        params = {
            'q': city,
            'appid': self.api_key,
            'units': 'metric'
        }
        
        try:
            response = requests.get(self.base_url, params=params)
            response.raise_for_status()
            data = response.json()
            
            temp = data['main']['temp']
            weather = data['weather'][0]['main'].lower()
            
            # Simple weather-based recommendations
            if temp < 10 or weather in ['rain', 'snow']:
                return 'warm'  # Suggest warm, comfort foods
            elif temp > 25:
                return 'cold'  # Suggest cold, refreshing foods
            else:
                return 'neutral'
                
        except requests.RequestException as e:
            print(f"Error fetching weather data: {e}")
            return None

class RecipeRecommendationService:
    def __init__(self):
        self.spoonacular = SpoonacularService()
        self.ai_service = AIRecipeService()
        self.weather_service = WeatherService()
    
    def get_recommendations(self, user, fridge_items, ah_bonus_items=None):
        """Get recipe recommendations based on user profile and available ingredients"""
        
        # Get user preferences
        profile = user.profile
        ingredients = [item.name for item in fridge_items]
        
        # Get weather influence
        weather_influence = self.weather_service.get_weather_influence()
        
        # Search for recipes using Spoonacular
        diet_preferences = profile.diet_preferences
        cuisine_preferences = profile.cuisine_preferences
        allergies = profile.allergies
        
        recipes = []
        
        # Try different cuisine types from user preferences
        for cuisine in cuisine_preferences[:2]:  # Try top 2 preferences
            spoon_recipes = self.spoonacular.search_recipes(
                ingredients=ingredients,
                diet=diet_preferences[0] if diet_preferences else None,
                cuisine=cuisine,
                intolerances=allergies,
                number=5
            )
            
            for recipe_data in spoon_recipes:
                # Get detailed recipe information
                detailed_recipe = self.spoonacular.get_recipe_details(recipe_data['id'])
                if detailed_recipe:
                    # Save or update recipe in database
                    recipe, created = Recipe.objects.get_or_create(
                        spoonacular_id=detailed_recipe['id'],
                        defaults={
                            'title': detailed_recipe['title'],
                            'description': detailed_recipe.get('summary', ''),
                            'ingredients': [ing['original'] for ing in detailed_recipe.get('extendedIngredients', [])],
                            'instructions': detailed_recipe.get('instructions', ''),
                            'prep_time': detailed_recipe.get('preparationMinutes', 30),
                            'cook_time': detailed_recipe.get('cookingMinutes', 30),
                            'servings': detailed_recipe.get('servings', 4),
                            'image_url': detailed_recipe.get('image', ''),
                            'source_url': detailed_recipe.get('sourceUrl', ''),
                            'cuisine_type': cuisine
                        }
                    )
                    recipes.append(recipe)
        
        # If no recipes found, try AI generation
        if not recipes:
            ai_recipe = self.ai_service.generate_recipe(
                ingredients=ingredients,
                preferences={
                    'cuisine': cuisine_preferences,
                    'diet': diet_preferences
                },
                allergies=allergies,
                dislikes=profile.dislikes
            )
            if ai_recipe:
                recipes.append(ai_recipe)
        
        return recipes[:5]  # Return top 5 recommendations