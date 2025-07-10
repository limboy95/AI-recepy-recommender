from django.contrib.auth.models import AbstractUser
from django.db import models

class AdminUser(models.Model):
    """Extended admin user model for two-factor authentication"""
    user = models.OneToOneField('auth.User', on_delete=models.CASCADE)
    two_factor_enabled = models.BooleanField(default=False)
    backup_tokens = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"Admin: {self.user.username}"

class AdminActivity(models.Model):
    """Log admin activities"""
    admin_user = models.ForeignKey('auth.User', on_delete=models.CASCADE)
    action = models.CharField(max_length=200)
    description = models.TextField()
    ip_address = models.GenericIPAddressField()
    timestamp = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-timestamp']
    
    def __str__(self):
        return f"{self.admin_user.username} - {self.action}"