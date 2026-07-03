import os
import requests
from dotenv import load_dotenv

load_dotenv()

OPENROUTER_API_KEY = os.getenv('OPENROUTER_API_KEY')
OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'

def get_ai_response(question):
    headers = {
        'Authorization': f'Bearer {OPENROUTER_API_KEY}',
        'Content-Type': 'application/json',
        'HTTP-Referer': os.getenv('FRONTEND_URL', 'http://localhost:5000'),
        'X-Title': 'Campus Assist Pro'
    }
    
    payload = {
        'model': 'openrouter/free',
        'messages': [
            {
                'role': 'system',
                'content': 'You are Campus Assist Pro, a helpful assistant for university students. Give practical, concise, friendly answers focused on campus life, academics, announcements, services, and event ideas. Keep answers short and structured. Prefer 3 to 6 bullet points or a small numbered list.'
            },
            {
                'role': 'user',
                'content': question
            }
        ]
    }
    
    response = requests.post(OPENROUTER_URL, json=payload, headers=headers)
    response.raise_for_status()
    
    data = response.json()
    
    return {
        'answer': data['choices'][0]['message']['content'],
        'model': data.get('model', 'openrouter/free')
    }