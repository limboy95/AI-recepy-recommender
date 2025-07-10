from django.contrib import admin
from .models import AdminUser, AdminActivity

@admin.register(AdminUser)
class AdminUserAdmin(admin.ModelAdmin):
    list_display = ('user', 'two_factor_enabled', 'created_at')
    list_filter = ('two_factor_enabled', 'created_at')
    search_fields = ('user__username', 'user__email')

@admin.register(AdminActivity)
class AdminActivityAdmin(admin.ModelAdmin):
    list_display = ('admin_user', 'action', 'ip_address', 'timestamp')
    list_filter = ('action', 'timestamp')
    search_fields = ('admin_user__username', 'action', 'description')
    readonly_fields = ('timestamp',)