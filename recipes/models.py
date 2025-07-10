from django.db import models
from accounts.models import User

class Recipe(models.Model):
    DIFFICULTY_CHOICES = [
        ('easy', 'Makkelijk'),
        ('medium', 'Gemiddeld'),
        ('hard', 'Moeilijk'),
    ]
    
    title = models.CharField(max_length=200)
    description = models.TextField()
    ingredients = models.JSONField()  # List of ingredients with quantities
    instructions = models.TextField()
    prep_time = models.IntegerField(help_text="Preparation time in minutes")
    cook_time = models.IntegerField(help_text="Cooking time in minutes")
    servings = models.IntegerField(default=4)
    difficulty = models.CharField(max_length=10, choices=DIFFICULTY_CHOICES, default='medium')
    cuisine_type = models.CharField(max_length=50, blank=True)
    diet_type = models.JSONField(default=list, blank=True)  # vegetarian, vegan, etc.
    image_url = models.URLField(blank=True)
    source_url = models.URLField(blank=True)
    spoonacular_id = models.IntegerField(null=True, blank=True, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return self.title
    
    @property
    def total_time(self):
        return self.prep_time + self.cook_time

class RecipeRecommendation(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='recipe_recommendations')
    recipe = models.ForeignKey(Recipe, on_delete=models.CASCADE)
    recommended_at = models.DateTimeField(auto_now_add=True)
    reason = models.TextField(blank=True)  # Why this recipe was recommended
    user_rating = models.IntegerField(null=True, blank=True, choices=[(i, i) for i in range(1, 6)])
    user_feedback = models.TextField(blank=True)
    
    class Meta:
        unique_together = ['user', 'recipe', 'recommended_at']
    
    def __str__(self):
        return f"{self.recipe.title} recommended to {self.user.email}"

class SavedRecipe(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='saved_recipes')
    recipe = models.ForeignKey(Recipe, on_delete=models.CASCADE)
    saved_at = models.DateTimeField(auto_now_add=True)
    notes = models.TextField(blank=True)
    
    class Meta:
        unique_together = ['user', 'recipe']
    
    def __str__(self):
        return f"{self.recipe.title} saved by {self.user.email}"