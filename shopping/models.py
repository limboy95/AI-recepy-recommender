from django.db import models
from accounts.models import User

class AHBonusItem(models.Model):
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    original_price = models.DecimalField(max_digits=10, decimal_places=2)
    bonus_price = models.DecimalField(max_digits=10, decimal_places=2)
    discount_percentage = models.IntegerField()
    category = models.CharField(max_length=100, blank=True)
    brand = models.CharField(max_length=100, blank=True)
    image_url = models.URLField(blank=True)
    valid_from = models.DateField()
    valid_until = models.DateField()
    ah_product_id = models.CharField(max_length=50, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-discount_percentage', 'name']
    
    def __str__(self):
        return f"{self.name} - {self.discount_percentage}% korting"

class ShoppingList(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='shopping_lists')
    name = models.CharField(max_length=100, default='Boodschappenlijst')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"{self.name} - {self.user.email}"

class ShoppingListItem(models.Model):
    shopping_list = models.ForeignKey(ShoppingList, on_delete=models.CASCADE, related_name='items')
    name = models.CharField(max_length=200)
    quantity = models.CharField(max_length=50, default='1')
    is_purchased = models.BooleanField(default=False)
    ah_bonus_item = models.ForeignKey(AHBonusItem, on_delete=models.SET_NULL, null=True, blank=True)
    estimated_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    notes = models.TextField(blank=True)
    added_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"{self.name} ({self.quantity})"
    
    @property
    def final_price(self):
        if self.ah_bonus_item:
            return self.ah_bonus_item.bonus_price
        return self.estimated_price

class RecipeShoppingList(models.Model):
    """Shopping list generated from a recipe"""
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    recipe = models.ForeignKey('recipes.Recipe', on_delete=models.CASCADE)
    shopping_list = models.OneToOneField(ShoppingList, on_delete=models.CASCADE)
    missing_ingredients = models.JSONField()  # Ingredients not in user's fridge
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"Shopping list for {self.recipe.title}"