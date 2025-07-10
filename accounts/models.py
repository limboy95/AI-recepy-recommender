from django.contrib.auth.models import AbstractUser
from django.db import models

class User(AbstractUser):
    email = models.EmailField(unique=True)
    privacy_accepted = models.BooleanField(default=False)
    profile_completed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']

class UserProfile(models.Model):
    CUISINE_CHOICES = [
        ('italian', 'Italiaans'),
        ('asian', 'Aziatisch'),
        ('mexican', 'Mexicaans'),
        ('french', 'Frans'),
        ('indian', 'Indiaas'),
        ('mediterranean', 'Mediterraans'),
        ('dutch', 'Nederlands'),
    ]
    
    DIET_CHOICES = [
        ('vegetarian', 'Vegetarisch'),
        ('vegan', 'Veganistisch'),
        ('halal', 'Halal'),
        ('kosher', 'Koosjer'),
        ('meat', 'Vlees'),
        ('pescatarian', 'Pescatarisch'),
    ]
    
    ALLERGY_CHOICES = [
        ('nuts', 'Noten'),
        ('gluten', 'Gluten'),
        ('lactose', 'Lactose'),
        ('fish', 'Vis'),
        ('shellfish', 'Schaaldieren'),
        ('eggs', 'Eieren'),
        ('soy', 'Soja'),
    ]
    
    GOAL_CHOICES = [
        ('muscle_gain', 'Spieropbouw'),
        ('weight_loss', 'Afvallen'),
        ('maintenance', 'Gewicht behouden'),
        ('health', 'Gezonder eten'),
    ]
    
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    cuisine_preferences = models.JSONField(default=list, blank=True)
    diet_preferences = models.JSONField(default=list, blank=True)
    allergies = models.JSONField(default=list, blank=True)
    dislikes = models.TextField(blank=True, help_text="Comma-separated list of disliked ingredients")
    diet_goal = models.CharField(max_length=20, choices=GOAL_CHOICES, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"Profile for {self.user.email}"

class FridgeItem(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='fridge_items')
    name = models.CharField(max_length=100)
    quantity = models.CharField(max_length=50, default='1')
    expiry_date = models.DateField(null=True, blank=True)
    image_url = models.URLField(blank=True)
    added_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ['user', 'name']
    
    def __str__(self):
        return f"{self.name} - {self.user.email}"