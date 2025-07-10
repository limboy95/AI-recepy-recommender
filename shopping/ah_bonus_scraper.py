import requests
from bs4 import BeautifulSoup
from datetime import datetime, timedelta
import json
import os
from django.utils import timezone
from .models import AHBonusItem

class AHBonusScraper:
    def __init__(self):
        self.base_url = "https://www.ah.nl"
        self.bonus_url = f"{self.base_url}/bonus"
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
    
    def scrape_bonus_items(self):
        """Scrape current bonus items from AH website"""
        try:
            response = requests.get(self.bonus_url, headers=self.headers)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.content, 'html.parser')
            
            # This is a simplified example - actual implementation would need
            # to be adapted based on AH's current website structure
            bonus_items = []
            
            # Find bonus product containers (structure may vary)
            product_containers = soup.find_all('div', class_='product-card')
            
            for container in product_containers:
                try:
                    name = container.find('h3').text.strip()
                    
                    # Extract prices
                    price_container = container.find('div', class_='price')
                    original_price = float(price_container.find('span', class_='original-price').text.replace('€', '').replace(',', '.'))
                    bonus_price = float(price_container.find('span', class_='bonus-price').text.replace('€', '').replace(',', '.'))
                    
                    # Calculate discount
                    discount_percentage = int(((original_price - bonus_price) / original_price) * 100)
                    
                    # Extract other details
                    image_url = container.find('img')['src'] if container.find('img') else ''
                    product_id = container.get('data-product-id', '')
                    
                    bonus_item = {
                        'name': name,
                        'original_price': original_price,
                        'bonus_price': bonus_price,
                        'discount_percentage': discount_percentage,
                        'image_url': image_url,
                        'ah_product_id': product_id,
                        'valid_from': timezone.now().date(),
                        'valid_until': timezone.now().date() + timedelta(days=7)
                    }
                    
                    bonus_items.append(bonus_item)
                    
                except Exception as e:
                    print(f"Error parsing product: {e}")
                    continue
            
            return bonus_items
            
        except requests.RequestException as e:
            print(f"Error scraping AH bonus items: {e}")
            return []
    
    def update_database(self):
        """Update database with scraped bonus items"""
        bonus_items = self.scrape_bonus_items()
        
        # Clear old bonus items
        AHBonusItem.objects.filter(valid_until__lt=timezone.now().date()).delete()
        
        # Add new bonus items
        for item_data in bonus_items:
            AHBonusItem.objects.update_or_create(
                ah_product_id=item_data['ah_product_id'],
                defaults=item_data
            )
        
        print(f"Updated {len(bonus_items)} bonus items")
        return len(bonus_items)

# Function to be called by cron job
def update_ah_bonus_cache():
    """Function to be called by cron job to update AH bonus cache"""
    scraper = AHBonusScraper()
    return scraper.update_database()