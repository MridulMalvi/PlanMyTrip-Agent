from openai import OpenAI

# Initialize the client with your API key
client = OpenAI(api_key='fe_oa_e23004d7d4e1f5845e2fbf0756f3e8e349e27f59c4190e1f')

try:
    print("Sending test request to OpenAI...")
    
    # Make a simple request to a basic model
    response = client.chat.completions.create(
        model="gpt-3.5-turbo",
        messages=[
            {"role": "user", "content": "Say 'Your API key is working!' if you get this."}
        ],
        max_tokens=20
    )
    
    print("\n✅ Success! The API responded with:")
    print(response.choices[0].message.content)

except Exception as e:
    print("\n❌ There was an error. Your API key might be invalid, expired, or out of credits.")
    print(f"Error details: {e}")