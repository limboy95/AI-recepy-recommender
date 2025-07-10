from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User, UserProfile, FridgeItem

@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ('email', 'username', 'is_staff', 'privacy_accepted', 'profile_completed', 'date_joined')
    list_filter = ('is_staff', 'is_superuser', 'privacy_accepted', 'profile_completed')
    search_fields = ('email', 'username')
    ordering = ('email',)

@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'diet_goal', 'created_at')
    list_filter = ('diet_goal', 'created_at')
    search_fields = ('user__email',)
    readonly_fields = ('created_at', 'updated_at')

@admin.register(FridgeItem)
class FridgeItemAdmin(admin.ModelAdmin):
    list_display = ('name', 'user', 'quantity', 'expiry_date', 'added_at')
    list_filter = ('added_at', 'expiry_date')
    search_fields = ('name', 'user__email')