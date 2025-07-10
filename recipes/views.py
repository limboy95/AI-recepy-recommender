from django.shortcuts import render, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .models import Recipe, RecipeRecommendation, SavedRecipe
from .services import RecipeRecommendationService
from accounts.models import FridgeItem
import json

@login_required
def recipe_recommendations(request):
    """Get recipe recommendations based on user's fridge items"""
    fridge_items = request.user.fridge_items.all()
    
    if not fridge_items.exists():
        return render(request, 'recipes/no_ingredients.html')
    
    # Get recommendations
    recommendation_service = RecipeRecommendationService()
    recommended_recipes = recommendation_service.get_recommendations(
        user=request.user,
        fridge_items=fridge_items
    )
    
    # Save recommendations to database
    for recipe in recommended_recipes:
        RecipeRecommendation.objects.get_or_create(
            user=request.user,
            recipe=recipe,
            defaults={
                'reason': f'Based on ingredients: {", ".join([item.name for item in fridge_items])}'
            }
        )
    
    context = {
        'recipes': recommended_recipes,
        'fridge_items': fridge_items
    }
    return render(request, 'recipes/recommendations.html', context)

@login_required
def recipe_detail(request, recipe_id):
    """Show detailed recipe information"""
    recipe = get_object_or_404(Recipe, id=recipe_id)
    is_saved = SavedRecipe.objects.filter(user=request.user, recipe=recipe).exists()
    
    context = {
        'recipe': recipe,
        'is_saved': is_saved
    }
    return render(request, 'recipes/detail.html', context)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def save_recipe(request, recipe_id):
    """Save or unsave a recipe"""
    recipe = get_object_or_404(Recipe, id=recipe_id)
    saved_recipe, created = SavedRecipe.objects.get_or_create(
        user=request.user,
        recipe=recipe
    )
    
    if not created:
        saved_recipe.delete()
        return Response({'saved': False})
    
    return Response({'saved': True})

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def rate_recipe(request, recipe_id):
    """Rate a recommended recipe"""
    recipe = get_object_or_404(Recipe, id=recipe_id)
    rating = request.data.get('rating')
    feedback = request.data.get('feedback', '')
    
    if not rating or not (1 <= int(rating) <= 5):
        return Response({'error': 'Invalid rating'}, status=400)
    
    recommendation = RecipeRecommendation.objects.filter(
        user=request.user,
        recipe=recipe
    ).first()
    
    if recommendation:
        recommendation.user_rating = rating
        recommendation.user_feedback = feedback
        recommendation.save()
        return Response({'success': True})
    
    return Response({'error': 'Recommendation not found'}, status=404)

@login_required
def saved_recipes(request):
    """Show user's saved recipes"""
    saved_recipes = SavedRecipe.objects.filter(user=request.user).select_related('recipe')
    
    context = {
        'saved_recipes': saved_recipes
    }
    return render(request, 'recipes/saved.html', context)