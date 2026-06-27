import os
from dotenv import load_dotenv

# Load .env file
load_dotenv()

class Config:
    PORT = int(os.getenv("PORT", 8000))
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
    MODEL_NAME = os.getenv("MODEL_NAME", "gemini-1.5-flash")
    
config = Config()
