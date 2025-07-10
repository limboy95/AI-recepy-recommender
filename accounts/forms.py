from django import forms
from allauth.account.forms import SignupForm
from captcha.fields import CaptchaField
from .models import UserProfile

class CustomSignupForm(SignupForm):
    captcha = CaptchaField()
    privacy_accepted = forms.BooleanField(
        required=True,
        label="Ik ga akkoord met de privacyverklaring"
    )
    
    def save(self, request):
        user = super().save(request)
        user.privacy_accepted = self.cleaned_data['privacy_accepted']
        user.save()
        return user

class UserProfileForm(forms.ModelForm):
    cuisine_preferences = forms.MultipleChoiceField(
        choices=UserProfile.CUISINE_CHOICES,
        widget=forms.CheckboxSelectMultiple,
        required=False
    )
    diet_preferences = forms.MultipleChoiceField(
        choices=UserProfile.DIET_CHOICES,
        widget=forms.CheckboxSelectMultiple,
        required=False
    )
    allergies = forms.MultipleChoiceField(
        choices=UserProfile.ALLERGY_CHOICES,
        widget=forms.CheckboxSelectMultiple,
        required=False
    )
    
    class Meta:
        model = UserProfile
        fields = ['cuisine_preferences', 'diet_preferences', 'allergies', 'dislikes', 'diet_goal']
        widgets = {
            'dislikes': forms.Textarea(attrs={'rows': 3, 'placeholder': 'Bijv: koriander, spruiten, blauwe kaas'}),
            'diet_goal': forms.Select(attrs={'class': 'form-control'})
        }
    
    def save(self, commit=True):
        profile = super().save(commit=False)
        if commit:
            profile.save()
            # Mark user profile as completed
            profile.user.profile_completed = True
            profile.user.save()
        return profile