import openai
import os
from dotenv import load_dotenv

load_dotenv()
openai.api_key = os.getenv("OPENAI_API_KEY")

response = openai.ChatCompletion.create(
    model="gpt-4",
    messages=[
        {"role": "system", "content": "Je bent een behulpzame assistent."},
        {"role": "user", "content": "Wat is een goed recept met broccoli?"}
    ]
)

print(response["choices"][0]["message"]["content"])