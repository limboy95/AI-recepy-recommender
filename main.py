from crewai import Agent, Task, Crew
from langchain.llms import OpenAI
from ah_bonus_scraper import scrape_ah_bonus
from dotenv import load_dotenv
import os

# 1. Laad .env variabelen
load_dotenv()

# 2. Haal OpenAI API key op
api_key = os.getenv("OPENAI_API_KEY")

if not api_key:
    raise ValueError("❌ OPENAI_API_KEY niet gevonden. Zorg dat .env correct is ingesteld.")

print("✅ OpenAI API key geladen:", api_key[:5] + "...")


# 3. AH promoties ophalen
ah_promoties = scrape_ah_bonus()
promotie_tekst = "\n".join(ah_promoties[:10])

# 4. Wat er al in de koelkast zit
gekoelde_ingredienten = [
    "broccoli",
    "roomkaas",
    "citroen",
    "geraspte kaas"
]

# 5. Gebruikersvoorkeur
voorkeur = "Gezond, snel klaar, vegetarisch en onder €10"

# 6. OpenAI LLM met expliciete API key
llm = OpenAI(
    temperature=0.6,
    model="gpt-3.5-turbo",
    openai_api_key=api_key
)

# 7. Agents
recept_zoeker = Agent(
    role="Receptenzoeker",
    goal="Vind recepten die passen bij voorkeur, bonus en koelkastinhoud",
    backstory="Een slimme chef die voedselverspilling minimaliseert",
    llm=llm,
    verbose=True
)

promo_koppelaar = Agent(
    role="Bonus-expert",
    goal="Koppel recepten aan promoties en aanwezige ingrediënten",
    backstory="Een boodschappenbespaarexpert",
    llm=llm,
    verbose=True
)

# 8. Taken
taak1 = Task(
    description=f"""
    Zoek 3 recepten die passen bij deze voorkeur: "{voorkeur}".
    
    ❄️ Ingrediënten die al in de koelkast zitten:
    {', '.join(gekoelde_ingredienten)}
    
    🛒 Actuele AH-promoties:
    {promotie_tekst}
    
    Kies recepten waarbij zoveel mogelijk van de koelkast-ingrediënten gebruikt worden.
    Geef per recept: naam, ingrediënten, welke al in huis zijn, kooktijd, en prijsinschatting.
    """,
    agent=recept_zoeker,
    expected_output="Een lijst van 3 recepten met naam, ingrediënten, welke al in de koelkast zitten, kooktijd en prijsinschatting."
)

taak2 = Task(
    description=f"""
    Geef per recept aan welke ingrediënten:
    - In de AH promoties zitten
    - Al in huis zijn
    - Nog gekocht moeten worden
    
    Gebruik deze actuele promoties:
    {promotie_tekst}
    
    En dit is de huidige koelkastinhoud:
    {', '.join(gekoelde_ingredienten)}
    
    Voeg per recept een kort overzicht toe van de verwachte besparing.
    """,
    agent=promo_koppelaar,
    expected_output="Per recept een overzicht van promotie-ingrediënten, aanwezige ingrediënten, te kopen ingrediënten en een korte besparingssamenvatting."
)

# 9. Crew starten
crew = Crew(
    agents=[recept_zoeker, promo_koppelaar],
    tasks=[taak1, taak2],
    verbose=True
)

result = crew.kickoff()
print("\n🔍 Resultaat:")
print(result)
