from .models import ShoppingList, ShoppingListItem, RecipeShoppingList, AHBonusItem
from .bonus_cache import BonusCache
from accounts.models import FridgeItem
from recipes.models import Recipe

class ShoppingListService:
    
    @staticmethod
    def create_recipe_shopping_list(user, recipe):
        """Create a shopping list based on a recipe and user's fridge contents"""
        
        # Get user's fridge items
        fridge_items = set(item.name.lower() for item in user.fridge_items.all())
        
        # Get recipe ingredients
        recipe_ingredients = recipe.ingredients
        if isinstance(recipe_ingredients, str):
            # If ingredients is a string, split by lines
            recipe_ingredients = recipe_ingredients.split('\n')
        
        # Find missing ingredients
        missing_ingredients = []
        for ingredient in recipe_ingredients:
            # Simple matching - in production, you'd want more sophisticated matching
            ingredient_name = ingredient.lower().strip()
            
            # Check if any fridge item contains this ingredient
            found_in_fridge = any(fridge_item in ingredient_name or ingredient_name in fridge_item 
                                for fridge_item in fridge_items)
            
            if not found_in_fridge:
                missing_ingredients.append(ingredient)
        
        # Create shopping list
        shopping_list = ShoppingList.objects.create(
            user=user,
            name=f"Boodschappen voor {recipe.title}"
        )
        
        # Find matching bonus items
        bonus_items = BonusCache.find_matching_bonus_items(missing_ingredients)
        bonus_dict = {item['name'].lower(): item for item in bonus_items}
        
        # Add missing ingredients to shopping list
        for ingredient in missing_ingredients:
            # Try to find matching bonus item
            matching_bonus = None
            for bonus_name, bonus_item in bonus_dict.items():
                if bonus_name in ingredient.lower() or ingredient.lower() in bonus_name:
                    matching_bonus = AHBonusItem.objects.get(id=bonus_item['id'])
                    break
            
            ShoppingListItem.objects.create(
                shopping_list=shopping_list,
                name=ingredient,
                ah_bonus_item=matching_bonus,
                estimated_price=matching_bonus.bonus_price if matching_bonus else None
            )
        
        # Create recipe shopping list record
        RecipeShoppingList.objects.create(
            user=user,
            recipe=recipe,
            shopping_list=shopping_list,
            missing_ingredients=missing_ingredients
        )
        
        return shopping_list
    
    @staticmethod
    def get_shopping_recommendations(user):
        """Get shopping recommendations based on user's preferences and current bonuses"""
        
        profile = user.profile
        
        # Get current bonus items
        bonus_items = BonusCache.get_bonus_items()
        
        # Filter based on user preferences
        recommended_items = []
        
        for item in bonus_items:
            # Simple filtering based on diet preferences
            item_name_lower = item['name'].lower()
            
            # Skip items that conflict with diet preferences
            if 'vegan' in profile.diet_preferences and any(meat in item_name_lower for meat in ['vlees', 'kip', 'vis', 'kaas', 'melk']):
                continue
            
            if 'vegetarian' in profile.diet_preferences and any(meat in item_name_lower for meat in ['vlees', 'kip', 'vis']):
                continue
            
            # Skip items with allergies
            if any(allergy in item_name_lower for allergy in profile.allergies):
                continue
            
            # Skip disliked items
            if profile.dislikes and any(dislike.strip().lower() in item_name_lower for dislike in profile.dislikes.split(',')):
                continue
            
            recommended_items.append(item)
        
        # Sort by discount percentage
        recommended_items.sort(key=lambda x: x['discount_percentage'], reverse=True)
        
        return recommended_items[:20]  # Return top 20 recommendations