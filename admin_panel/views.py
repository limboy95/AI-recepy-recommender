from django.shortcuts import render, redirect
from django.contrib.auth.decorators import user_passes_test
from django.contrib.auth import authenticate, login
from django.contrib import messages
from django.db.models import Count, Q
from django.utils import timezone
from datetime import timedelta
from accounts.models import User, UserProfile
from recipes.models import Recipe, RecipeRecommendation
from shopping.models import AHBonusItem, ShoppingList
from .models import AdminActivity

def is_admin(user):
    return user.is_staff and user.is_superuser

@user_passes_test(is_admin)
def admin_dashboard(request):
    """Admin dashboard with overview statistics"""
    
    # Log admin activity
    AdminActivity.objects.create(
        admin_user=request.user,
        action='Dashboard Access',
        description='Accessed admin dashboard',
        ip_address=request.META.get('REMOTE_ADDR', '0.0.0.0')
    )
    
    # Get statistics
    total_users = User.objects.count()
    active_users = User.objects.filter(last_login__gte=timezone.now() - timedelta(days=30)).count()
    completed_profiles = User.objects.filter(profile_completed=True).count()
    
    total_recipes = Recipe.objects.count()
    total_recommendations = RecipeRecommendation.objects.count()
    total_bonus_items = AHBonusItem.objects.filter(valid_until__gte=timezone.now().date()).count()
    
    # Recent activity
    recent_users = User.objects.order_by('-date_joined')[:10]
    recent_recommendations = RecipeRecommendation.objects.select_related('user', 'recipe').order_by('-recommended_at')[:10]
    
    context = {
        'total_users': total_users,
        'active_users': active_users,
        'completed_profiles': completed_profiles,
        'total_recipes': total_recipes,
        'total_recommendations': total_recommendations,
        'total_bonus_items': total_bonus_items,
        'recent_users': recent_users,
        'recent_recommendations': recent_recommendations,
    }
    
    return render(request, 'admin_panel/dashboard.html', context)

@user_passes_test(is_admin)
def user_management(request):
    """Manage users and their profiles"""
    
    users = User.objects.select_related('profile').annotate(
        recipe_count=Count('recipe_recommendations'),
        shopping_list_count=Count('shopping_lists')
    ).order_by('-date_joined')
    
    # Filter options
    filter_type = request.GET.get('filter')
    if filter_type == 'active':
        users = users.filter(last_login__gte=timezone.now() - timedelta(days=30))
    elif filter_type == 'incomplete_profile':
        users = users.filter(profile_completed=False)
    elif filter_type == 'no_activity':
        users = users.filter(recipe_recommendations__isnull=True)
    
    context = {
        'users': users,
        'filter_type': filter_type,
    }
    
    return render(request, 'admin_panel/user_management.html', context)

@user_passes_test(is_admin)
def user_detail(request, user_id):
    """Detailed view of a specific user"""
    
    user = User.objects.select_related('profile').get(id=user_id)
    
    # Get user's activity
    recommendations = RecipeRecommendation.objects.filter(user=user).select_related('recipe').order_by('-recommended_at')
    shopping_lists = ShoppingList.objects.filter(user=user).order_by('-created_at')
    fridge_items = user.fridge_items.all()
    
    context = {
        'user_obj': user,  # Renamed to avoid conflict with request.user
        'recommendations': recommendations,
        'shopping_lists': shopping_lists,
        'fridge_items': fridge_items,
    }
    
    return render(request, 'admin_panel/user_detail.html', context)

@user_passes_test(is_admin)
def recipe_analytics(request):
    """Analytics for recipes and recommendations"""
    
    # Most recommended recipes
    popular_recipes = Recipe.objects.annotate(
        recommendation_count=Count('reciperecommendation')
    ).order_by('-recommendation_count')[:20]
    
    # Recipe ratings
    rated_recipes = Recipe.objects.filter(
        reciperecommendation__user_rating__isnull=False
    ).annotate(
        avg_rating=models.Avg('reciperecommendation__user_rating'),
        rating_count=Count('reciperecommendation__user_rating')
    ).order_by('-avg_rating')[:20]
    
    # Cuisine preferences
    cuisine_stats = UserProfile.objects.exclude(cuisine_preferences=[]).values_list('cuisine_preferences', flat=True)
    
    context = {
        'popular_recipes': popular_recipes,
        'rated_recipes': rated_recipes,
        'cuisine_stats': cuisine_stats,
    }
    
    return render(request, 'admin_panel/recipe_analytics.html', context)

@user_passes_test(is_admin)
def bonus_management(request):
    """Manage AH bonus items"""
    
    from shopping.ah_bonus_scraper import update_ah_bonus_cache
    
    if request.method == 'POST' and 'refresh_cache' in request.POST:
        try:
            count = update_ah_bonus_cache()
            messages.success(request, f'{count} bonus items updated!')
        except Exception as e:
            messages.error(request, f'Error updating bonus cache: {e}')
        
        return redirect('bonus_management')
    
    # Get current bonus items
    bonus_items = AHBonusItem.objects.filter(
        valid_until__gte=timezone.now().date()
    ).order_by('-discount_percentage')
    
    # Statistics
    total_items = bonus_items.count()
    avg_discount = bonus_items.aggregate(models.Avg('discount_percentage'))['discount_percentage__avg'] or 0
    
    context = {
        'bonus_items': bonus_items,
        'total_items': total_items,
        'avg_discount': round(avg_discount, 1),
    }
    
    return render(request, 'admin_panel/bonus_management.html', context)

def admin_login(request):
    """Custom admin login with two-factor authentication placeholder"""
    
    if request.method == 'POST':
        username = request.POST.get('username')
        password = request.POST.get('password')
        
        user = authenticate(request, username=username, password=password)
        
        if user and user.is_staff and user.is_superuser:
            # In production, implement 2FA here
            login(request, user)
            return redirect('admin_dashboard')
        else:
            messages.error(request, 'Invalid credentials or insufficient permissions')
    
    return render(request, 'admin_panel/login.html')