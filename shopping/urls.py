from django.urls import path
from . import views

urlpatterns = [
    path('shopping/', views.shopping_lists, name='shopping_lists'),
    path('shopping/<int:list_id>/', views.shopping_list_detail, name='shopping_list_detail'),
    path('shopping/recipe/<int:recipe_id>/', views.create_recipe_shopping_list, name='create_recipe_shopping_list'),
    path('shopping/bonus/', views.bonus_recommendations, name='bonus_recommendations'),
    path('shopping/item/<int:item_id>/toggle/', views.toggle_item_purchased, name='toggle_item_purchased'),
    path('shopping/add-bonus/', views.add_bonus_to_list, name='add_bonus_to_list'),
    path('fridge/', views.fridge_management, name='fridge_management'),
    path('fridge/<int:item_id>/remove/', views.remove_fridge_item, name='remove_fridge_item'),
]