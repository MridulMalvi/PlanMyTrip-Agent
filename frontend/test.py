import os
import google.generativeai as genai
from dotenv import load_dotenv

# Load API key from .env file
load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")

if not api_key:
    print("❌ GEMINI_API_KEY not found in environment variables.")
    print("   Make sure you have a .env file with GEMINI_API_KEY=your-key-here")
    exit(1)

genai.configure(api_key=api_key)

try:
    print("Sending test request to Gemini...")

    model = genai.GenerativeModel("gemini-2.0-flash")
    response = model.generate_content(
        "Say 'Your Gemini API key is working!' if you get this."
    )

    print("\n✅ Success! The API responded with:")
    print(response.text)

except Exception as e:
    print("\n❌ There was an error. Your API key might be invalid, expired, or out of credits.")
    print(f"Error details: {e}")