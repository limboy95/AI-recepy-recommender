import json
import os
from datetime import datetime, timedelta
from ah_bonus_scraper import scrape_ah_bonus

CACHE_FILE = "cached_promoties.json"

def load_cached_promoties():
    if not os.path.exists(CACHE_FILE):
        return None

    with open(CACHE_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    last_updated = datetime.fromisoformat(data["date"])
    now = datetime.now()

    # Check of het vandaag zaterdag is en na 6:00
    if now.weekday() == 5 and now.hour >= 6:
        # Het is zaterdag en we mogen opnieuw scrapen
        if now.date() > last_updated.date():
            return None  # Force refresh
    elif (now - last_updated) > timedelta(days=7):
        return None  # Data te oud

    return data["promoties"]

def save_promoties_to_file(promoties):
    with open(CACHE_FILE, "w", encoding="utf-8") as f:
        json.dump({
            "date": datetime.now().isoformat(),
            "promoties": promoties
        }, f)

def get_bonus_promoties():
    cached = load_cached_promoties()
    if cached:
        print("✅ Gegevens uit cache geladen")
        return cached

    print("🔄 Nieuwe promoties ophalen van AH...")
    scraped = scrape_ah_bonus()
    save_promoties_to_file(scraped)
    return scraped
