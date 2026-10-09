import os
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

url: str = os.getenv("SUPABASE_URL")
key: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not url or not key:
    print("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set.")
    exit(1)

try:
    supabase: Client = create_client(url, key)
    response = supabase.auth.admin.list_users()
    print("Successfully connected to the Supabase account via REST API!")
    print(f"Found {len(response)} users in the database.")
except Exception as e:
    print(f"Failed to connect to Supabase: {e}")
