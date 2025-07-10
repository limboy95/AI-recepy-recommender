from django.shortcuts import render, get_object_or_404, redirect
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.http import JsonResponse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .models import ShoppingList, ShoppingListItem, AHBonusItem
from .services import ShoppingListService
from .bonus_cache import BonusCache
from recipes.models import Recipe

@login_required
def shopping_lists(request):
    """Show user's shopping lists"""
    lists = ShoppingList.objects.filter(user=request.user).order_by('-created_at')
    
    context = {
        'shopping_lists': lists
    }
    return render(request, 'shopping/lists.html', context)

@login_required
def shopping_list_detail(request, list_id):
    """Show detailed shopping list"""
    shopping_list = get_object_or_404(ShoppingList, id=list_id, user=request.user)
    
    context = {
        'shopping_list': shopping_list,
        'items': shopping_list.items.all()
    }
    return render(request, 'shopping/list_detail.html', context)

@login_required
def create_recipe_shopping_list(request, recipe_id):
    """Create shopping list from recipe"""
    recipe = get_object_or_404(Recipe, id=recipe_id)
    
    shopping_list = ShoppingListService.create_recipe_shopping_list(
        user=request.user,
        recipe=recipe
    )
    
    messages.success(request, f'Boodschappenlijst aangemaakt voor {recipe.title}!')
    return redirect('shopping_list_detail', list_id=shopping_list.id)

@login_required
def bonus_recommendations(request):
    """Show AH bonus recommendations based on user preferences"""
    recommendations = ShoppingListService.get_shopping_recommendations(request.user)
    
    context = {
        'bonus_items': recommendations
    }
    return render(request, 'shopping/bonus_recommendations.html', context)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def toggle_item_purchased(request, item_id):
    """Toggle shopping list item as purchased/unpurchased"""
    item = get_object_or_404(ShoppingListItem, id=item_id, shopping_list__user=request.user)
    item.is_purchased = not item.is_purchased
    item.save()
    
    return Response({'is_purchased': item.is_purchased})

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def add_bonus_to_list(request):
    """Add bonus item to shopping list"""
    bonus_item_id = request.data.get('bonus_item_id')
    shopping_list_id = request.data.get('shopping_list_id')
    
    if not bonus_item_id:
        return Response({'error': 'Bonus item ID required'}, status=400)
    
    bonus_item = get_object_or_404(AHBonusItem, id=bonus_item_id)
    
    # Get or create default shopping list
    if shopping_list_id:
        shopping_list = get_object_or_404(ShoppingList, id=shopping_list_id, user=request.user)
    else:
        shopping_list, created = ShoppingList.objects.get_or_create(
            user=request.user,
            name='Mijn Boodschappenlijst',
            defaults={'name': 'Mijn Boodschappenlijst'}
        )
    
    # Add item to shopping list
    list_item, created = ShoppingListItem.objects.get_or_create(
        shopping_list=shopping_list,
        name=bonus_item.name,
        defaults={
            'ah_bonus_item': bonus_item,
            'estimated_price': bonus_item.bonus_price
        }
    )
    
    if not created:
        return Response({'message': 'Item already in shopping list'})
    
    return Response({'message': 'Item added to shopping list', 'shopping_list_id': shopping_list.id})

@login_required
def fridge_management(request):
    """Manage fridge items with autocomplete"""
    from accounts.models import FridgeItem
    
    if request.method == 'POST':
        item_name = request.POST.get('item_name')
        quantity = request.POST.get('quantity', '1')
        
        if item_name:
            FridgeItem.objects.get_or_create(
                user=request.user,
                name=item_name,
                defaults={'quantity': quantity}
            )
            messages.success(request, f'{item_name} toegevoegd aan koelkast!')
        
        return redirect('fridge_management')
    
    fridge_items = request.user.fridge_items.all()
    
    context = {
        'fridge_items': fridge_items
    }
    return render(request, 'shopping/fridge_management.html', context)

@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def remove_fridge_item(request, item_id):
    """Remove item from fridge"""
    from accounts.models import FridgeItem
    
    item = get_object_or_404(FridgeItem, id=item_id, user=request.user)
    item.delete()
    
    return Response({'message': 'Item removed from fridge'})