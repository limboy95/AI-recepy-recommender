from django.urls import path
from . import views

urlpatterns = [
    path('recipes/recommendations/', views.recipe_recommendations, name='recipe_recommendations'),
    path('recipes/<int:recipe_id>/', views.recipe_detail, name='recipe_detail'),
    path('recipes/<int:recipe_id>/save/', views.save_recipe, name='save_recipe'),
    path('recipes/<int:recipe_id>/rate/', views.rate_recipe, name='rate_recipe'),
    path('recipes/saved/', views.saved_recipes, name='saved_recipes'),
]