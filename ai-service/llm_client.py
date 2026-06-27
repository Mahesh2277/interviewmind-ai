import re
import json
from config import config
from prompts import SYSTEM_JSON_INSTRUCTION

# Flag indicators
gemini_active = False
openai_active = False

# 1. Initialize Gemini
if config.GEMINI_API_KEY:
    try:
        import google.generativeai as genai
        genai.configure(api_key=config.GEMINI_API_KEY)
        gemini_active = True
        print("LLM CLIENT: Gemini API initialized successfully.")
    except Exception as e:
        print("LLM CLIENT ERROR: Failed to configure Gemini SDK:", e)

# 2. Initialize OpenAI
if config.OPENAI_API_KEY:
    try:
        from openai import OpenAI
        openai_client = OpenAI(api_key=config.OPENAI_API_KEY)
        openai_active = True
        print("LLM CLIENT: OpenAI API client initialized successfully.")
    except Exception as e:
        print("LLM CLIENT ERROR: Failed to configure OpenAI SDK:", e)


def clean_json_text(raw_text: str) -> str:
    """
    Cleans formatting wrappers (like ```json ... ```) from LLM responses
    so that json.loads can parse it correctly.
    """
    raw_text = raw_text.strip()
    # Strip markdown wrappers
    match = re.search(r'```(?:json)?\s*(.*?)\s*```', raw_text, re.DOTALL)
    if match:
        return match.group(1).strip()
    return raw_text


def query_llm_raw(system_prompt: str, user_prompt: str) -> str:
    """
    Sends request to Gemini (primary) or OpenAI (fallback).
    """
    combined_system = f"{SYSTEM_JSON_INSTRUCTION}\n{system_prompt}"

    # Try Gemini first
    if gemini_active:
        try:
            import google.generativeai as genai
            model = genai.GenerativeModel(
                model_name=config.MODEL_NAME or "gemini-1.5-flash",
                generation_config={"response_mime_type": "application/json"}
            )
            
            # Gemini SDK supports system instructions directly in the constructor or content.
            # In google-generativeai, system_instruction can be set on GenerativeModel initialization
            model_with_sys = genai.GenerativeModel(
                model_name=config.MODEL_NAME or "gemini-1.5-flash",
                system_instruction=combined_system,
                generation_config={"response_mime_type": "application/json"}
            )
            
            response = model_with_sys.generate_content(user_prompt)
            if response and response.text:
                return response.text
        except Exception as gemini_err:
            print(f"LLM CLIENT WARNING: Gemini generation failed: {gemini_err}. Checking OpenAI fallback...")

    # Try OpenAI next
    if openai_active:
        try:
            response = openai_client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": combined_system},
                    {"role": "user", "content": user_prompt}
                ],
                response_format={"type": "json_object"},
                temperature=0.3
            )
            return response.choices[0].message.content
        except Exception as openai_err:
            print(f"LLM CLIENT ERROR: OpenAI generation failed: {openai_err}")

    # No services available
    raise ConnectionError("Both Gemini and OpenAI services are inactive or failed to respond.")


def query_llm_json(system_prompt: str, user_prompt: str, fallback_structure: dict) -> dict:
    """
    Executes raw LLM query, cleans the text output, and loads it as JSON.
    Returns the fallback_structure on failure.
    """
    try:
        raw_output = query_llm_raw(system_prompt, user_prompt)
        cleaned_output = clean_json_text(raw_output)
        return json.loads(cleaned_output)
    except Exception as e:
        print(f"LLM CLIENT EXCEPTION: Fallback triggered. Error details: {e}")
        return fallback_structure
