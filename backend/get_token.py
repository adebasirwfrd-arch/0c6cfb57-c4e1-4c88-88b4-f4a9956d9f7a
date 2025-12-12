"""
MANUAL GOOGLE DRIVE TOKEN GENERATOR
====================================
Run this script, copy the URL, paste in browser, authorize, 
paste the code back here, and a token file will be created.
"""
from google_auth_oauthlib.flow import Flow
from dotenv import load_dotenv
import os
import json
from pathlib import Path

load_dotenv()

SCOPES = ['https://www.googleapis.com/auth/drive.file']

def main():
    client_id = os.getenv("GOOGLE_CLIENT_ID")
    client_secret = os.getenv("GOOGLE_CLIENT_SECRET")
    
    if not client_id or not client_secret:
        print("[ERROR] Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET in .env")
        return
    
    print("=" * 60)
    print("  GOOGLE DRIVE MANUAL AUTHORIZATION")
    print("=" * 60)
    print()
    
    # Create flow with out-of-band redirect
    client_config = {
        "installed": {
            "client_id": client_id,
            "client_secret": client_secret,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": ["urn:ietf:wg:oauth:2.0:oob"]
        }
    }
    
    flow = Flow.from_client_config(client_config, scopes=SCOPES, redirect_uri="urn:ietf:wg:oauth:2.0:oob")
    
    # Generate authorization URL
    auth_url, _ = flow.authorization_url(prompt='consent')
    
    print("1. Copy this URL and open it in ANY browser:")
    print()
    print(auth_url)
    print()
    print("2. Sign in with your Google account (ade.basirwfrd@gmail.com)")
    print("3. Click 'Allow' to grant access")
    print("4. Copy the authorization code shown")
    print()
    
    code = input("5. Paste the authorization code here: ").strip()
    
    if not code:
        print("[ERROR] No code provided")
        return
    
    try:
        flow.fetch_token(code=code)
        creds = flow.credentials
        
        # Save token
        token_path = Path(__file__).parent / "services" / "google_token.json"
        token_data = {
            "token": creds.token,
            "refresh_token": creds.refresh_token,
            "token_uri": creds.token_uri,
            "client_id": creds.client_id,
            "client_secret": creds.client_secret,
            "scopes": creds.scopes
        }
        
        with open(token_path, 'w') as f:
            json.dump(token_data, f, indent=2)
        
        print()
        print("=" * 60)
        print("  SUCCESS! Token saved.")
        print("=" * 60)
        print(f"Token file: {token_path}")
        print()
        print("Now restart main.py and uploads should work!")
        
    except Exception as e:
        print(f"[ERROR] Failed to get token: {e}")

if __name__ == "__main__":
    main()
