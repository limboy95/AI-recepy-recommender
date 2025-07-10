from django.contrib import admin
from .models import AHBonusItem, ShoppingList, ShoppingListItem, RecipeShoppingList

@admin.register(AHBonusItem)
class AHBonusItemAdmin(admin.ModelAdmin):
    list_display = ('name', 'original_price', 'bonus_price', 'discount_percentage', 'valid_from', 'valid_until')
    list_filter = ('discount_percentage', 'category', 'valid_from', 'valid_until')
    search_fields = ('name', 'brand', 'category')
    readonly_fields = ('created_at', 'updated_at')

@admin.register(ShoppingList)
class ShoppingListAdmin(admin.ModelAdmin):
    list_display = ('name', 'user', 'created_at')
    list_filter = ('created_at',)
    search_fields = ('name', 'user__email')

@admin.register(ShoppingListItem)
class ShoppingListItemAdmin(admin.ModelAdmin):
    list_display = ('name', 'shopping_list', 'quantity', 'is_purchased', 'final_price')
    list_filter = ('is_purchased', 'added_at')
    search_fields = ('name', 'shopping_list__name')

@admin.register(RecipeShoppingList)
class RecipeShoppingListAdmin(admin.ModelAdmin):
    list_display = ('recipe', 'user', 'created_at')
    list_filter = ('created_at',)
    search_fields = ('recipe__title', 'user__email')