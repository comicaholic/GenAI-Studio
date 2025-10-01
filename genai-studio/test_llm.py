import requests
import os

# Test if GROQ_API_KEY is set
groq_key = os.getenv("GROQ_API_KEY")
print(f"GROQ_API_KEY is set: {bool(groq_key)}")
if groq_key:
    print(f"GROQ_API_KEY length: {len(groq_key)}")

# Test backend health
try:
    response = requests.get("http://localhost:8000/api/health")
    print(f"Backend health status: {response.status_code}")
    if response.status_code == 200:
        print("Backend is running!")
    else:
        print(f"Backend error: {response.text}")
except Exception as e:
    print(f"Backend connection failed: {e}")

# Test LLM endpoint
try:
    test_data = {
        "model_id": "llama-3.1-8b-instant",
        "messages": [
            {"role": "user", "content": "Hello, how are you?"}
        ],
        "params": {
            "max_tokens": 100,
            "temperature": 0.7
        }
    }
    response = requests.post("http://localhost:8000/api/llm/chat", json=test_data)
    print(f"LLM chat endpoint status: {response.status_code}")
    if response.status_code == 200:
        print("LLM endpoint works!")
        print(f"Response: {response.json()}")
    else:
        print(f"LLM endpoint error: {response.text}")
except Exception as e:
    print(f"LLM endpoint test failed: {e}")

