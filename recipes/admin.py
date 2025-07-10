from django.contrib import admin
from .models import Recipe, RecipeRecommendation, SavedRecipe

@admin.register(Recipe)
class RecipeAdmin(admin.ModelAdmin):
    list_display = ('title', 'cuisine_type', 'difficulty', 'prep_time', 'cook_time', 'servings')
    list_filter = ('difficulty', 'cuisine_type', 'created_at')
    search_fields = ('title', 'description')
    readonly_fields = ('created_at',)

@admin.register(RecipeRecommendation)
class RecipeRecommendationAdmin(admin.ModelAdmin):
    list_display = ('recipe', 'user', 'user_rating', 'recommended_at')
    list_filter = ('user_rating', 'recommended_at')
    search_fields = ('recipe__title', 'user__email')

@admin.register(SavedRecipe)
class SavedRecipeAdmin(admin.ModelAdmin):
    list_display = ('recipe', 'user', 'saved_at')
    list_filter = ('saved_at',)
    search_fields = ('recipe__title', 'user__email')