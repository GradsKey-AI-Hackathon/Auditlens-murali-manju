import os
import json
from groq import Groq
from dotenv import load_dotenv

load_dotenv("/home/hackathon/.env")

client = Groq(api_key=os.getenv("GROQ_API_KEY"))


def extract_invoice(raw_text: str) -> dict:
    """
    Convert raw vendor invoice text into structured JSON.

    Input:
        raw_text: Unstructured invoice text.

    Output:
        {
            "po_id": "...",
            "item_name": "...",
            "quantity_delivered": 0,
            "unit_price_charged": 0
        }
    """

    prompt = f"""
You are an invoice data extraction system.

Extract ONLY the following fields from the invoice text:

- po_id
- item_name
- quantity_delivered
- unit_price_charged

Return ONLY valid JSON.
Do not include markdown.
Do not include explanations.

Rules:
- quantity_delivered must be a number.
- unit_price_charged must be a number.
- If a field cannot be found, use null.
- Preserve the PO ID and item name exactly as written.

Invoice text:
{raw_text}
"""

    response = client.chat.completions.create(
        model="openai/gpt-oss-20b",
        messages=[
            {
                "role": "user",
                "content": prompt
            }
        ],
        temperature=0,
    )

    content = response.choices[0].message.content.strip()

    try:
        data = json.loads(content)
    except json.JSONDecodeError:
        raise ValueError(f"AI returned invalid JSON: {content}")

    return {
        "po_id": data.get("po_id"),
        "item_name": data.get("item_name"),
        "quantity_delivered": data.get("quantity_delivered"),
        "unit_price_charged": data.get("unit_price_charged"),
    }
