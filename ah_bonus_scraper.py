import requests
from bs4 import BeautifulSoup

def scrape_ah_bonus(url="https://www.ah.nl/bonus"):
    headers = {
        "User-Agent": "Mozilla/5.0"
    }

    response = requests.get(url, headers=headers)
    if response.status_code != 200:
        print("Fout bij ophalen pagina:", response.status_code)
        return []

    soup = BeautifulSoup(response.text, "html.parser")

    producten = []
    bonus_cards = soup.select('[data-testhook="bonus-tile"]')

    for card in bonus_cards:
        try:
            naam = card.select_one('[data-testhook="product-title"]').text.strip()
            prijs = card.select_one('[data-testhook="product-price"]').text.strip()
            actie = card.select_one('[data-testhook="discount-label"]').text.strip()
            producten.append(f"{naam} - {actie} ({prijs})")
        except Exception:
            continue

    return producten

