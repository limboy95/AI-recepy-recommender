from django.core.cache import cache
from django.utils import timezone
from .models import AHBonusItem
import json

class BonusCache:
    CACHE_KEY = 'ah_bonus_items'
    CACHE_TIMEOUT = 60 * 60 * 24  # 24 hours
    
    @classmethod
    def get_bonus_items(cls, category=None, search_term=None):
        """Get bonus items from cache or database"""
        cache_key = cls.CACHE_KEY
        if category:
            cache_key += f"_{category}"
        if search_term:
            cache_key += f"_{search_term}"
        
        # Try to get from cache first
        cached_items = cache.get(cache_key)
        if cached_items:
            return cached_items
        
        # Get from database
        queryset = AHBonusItem.objects.filter(
            valid_until__gte=timezone.now().date()
        )
        
        if category:
            queryset = queryset.filter(category__icontains=category)
        
        if search_term:
            queryset = queryset.filter(name__icontains=search_term)
        
        items = list(queryset.values())
        
        # Cache the results
        cache.set(cache_key, items, cls.CACHE_TIMEOUT)
        
        return items
    
    @classmethod
    def clear_cache(cls):
        """Clear all bonus items cache"""
        cache.delete_pattern(f"{cls.CACHE_KEY}*")
    
    @classmethod
    def find_matching_bonus_items(cls, ingredient_names):
        """Find bonus items that match ingredient names"""
        matching_items = []
        
        for ingredient in ingredient_names:
            # Search for bonus items that contain the ingredient name
            items = cls.get_bonus_items(search_term=ingredient)
            matching_items.extend(items)
        
        # Remove duplicates
        seen_ids = set()
        unique_items = []
        for item in matching_items:
            if item['id'] not in seen_ids:
                unique_items.append(item)
                seen_ids.add(item['id'])
        
        return unique_items