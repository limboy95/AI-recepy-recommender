from django.shortcuts import render, redirect
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.views.generic import TemplateView
from .forms import UserProfileForm
from .models import UserProfile

class HomeView(TemplateView):
    template_name = 'home.html'

@login_required
def dashboard(request):
    if not request.user.profile_completed:
        return redirect('profile_setup')
    
    context = {
        'user': request.user,
        'fridge_items': request.user.fridge_items.all()[:5],  # Show latest 5 items
    }
    return render(request, 'accounts/dashboard.html', context)

@login_required
def profile_setup(request):
    try:
        profile = request.user.profile
    except UserProfile.DoesNotExist:
        profile = UserProfile.objects.create(user=request.user)
    
    if request.method == 'POST':
        form = UserProfileForm(request.POST, instance=profile)
        if form.is_valid():
            form.save()
            messages.success(request, 'Profiel succesvol ingesteld!')
            return redirect('dashboard')
    else:
        form = UserProfileForm(instance=profile)
    
    return render(request, 'accounts/profile_setup.html', {'form': form})

@login_required
def profile_edit(request):
    try:
        profile = request.user.profile
    except UserProfile.DoesNotExist:
        profile = UserProfile.objects.create(user=request.user)
    
    if request.method == 'POST':
        form = UserProfileForm(request.POST, instance=profile)
        if form.is_valid():
            form.save()
            messages.success(request, 'Profiel bijgewerkt!')
            return redirect('dashboard')
    else:
        form = UserProfileForm(instance=profile)
    
    return render(request, 'accounts/profile_edit.html', {'form': form})