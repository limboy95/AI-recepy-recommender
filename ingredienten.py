INGREDIENTEN_KOELKAST = [
    # 🥦 Groenten
    "broccoli", "wortel", "paprika", "komkommer", "courgette", "avocado",
    "spinazie", "sla", "champignons", "tomaat", "prei", "ui", "knoflook",

    # 🥄 Zuivel
    "melk", "room", "roomkaas", "geraspte kaas", "feta", "mozzarella", "yoghurt",
    "kwark", "boter", "slagroom", "parmezaan",

    # 🥗 Vlees, vis & vervangers
    "kipfilet", "gehakt", "zalmsnippers", "tonijn", "vissticks",
    "vegetarische burgers", "tofu", "tempeh", "spekblokjes", "ham", "salami",

    # 🥚 Eieren
    "eieren", "ei",

    # 🥞 Brood/ontbijt
    "bruin brood", "wit brood", "pistolets", "croissants", "wraps", "tortilla's",
    "pannenkoekenbeslag",

    # 🧂 Sauzen/spreads
    "mayonaise", "ketchup", "pesto", "currysaus", "chilisaus", "hummus", "guacamole",

    # 🍵 Dranken
    "melk", "chocolademelk", "fruitsap", "frisdrank", "sojamelk", "havermelk", "karnemelk",

    # 🍰 Toetjes/snacks
    "vla", "pudding", "fruit yoghurt", "chocolade mousse", "dessertsaus",

    # 🍋 Fruit (koel bewaard)
    "citroen", "aardbeien", "blauwe bessen", "watermeloen", "mango", "druiven",

    # 🧊 Overig gekoeld
    "verse pasta", "kant-en-klare maaltijd", "verse soep", "pizza", "croissantdeeg"
]


def toon_ingredient_opties():
    """Print de lijst met beschikbare ingrediënten voorzien van nummers."""
    print("\nBeschikbare ingrediënten:")
    for idx, item in enumerate(INGREDIENTEN_KOELKAST, start=1):
        print(f"{idx:2}. {item}")


def kies_ingredienten():
    """Laat de gebruiker een selectie maken uit de ingrediëntenlijst.

    Geeft een lijst van gekozen ingrediënten terug.
    """
    toon_ingredient_opties()
    keuze = input("\nVoer de nummers in van de ingrediënten die je wilt selecteren (gescheiden door komma's): ")
    indices = []
    for part in keuze.split(','):
        part = part.strip()
        if part.isdigit():
            i = int(part)
            if 1 <= i <= len(INGREDIENTEN_KOELKAST):
                indices.append(i)
    geselecteerd = [INGREDIENTEN_KOELKAST[i-1] for i in indices]
    return geselecteerd
