import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

def get_supabase_client() -> Client:
    url = os.environ.get("https://rsqxcskbiuasyzrcifse.supabase.co")
    key = os.environ.get("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzcXhjc2tiaXVhc3l6cmNpZnNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMwMzc3NTIsImV4cCI6MjEwODYxMzc1Mn0.dXNVtAL-i3v1fnHfwjHgfTUjjVjFtCQc27Dnzw-avR0")
    
    if not url or not key:
        raise ValueError("Environment variable SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY wajib diisi.")
        
    return create_client(url, key)
