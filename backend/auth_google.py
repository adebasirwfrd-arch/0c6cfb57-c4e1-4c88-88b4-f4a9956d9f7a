"""
Run this script ONCE to authenticate with Google Drive.
It will open a browser window for you to sign in and authorize the app.
After successful auth, a google_token.json file will be created.
"""
from google_auth_oauthlib.flow import InstalledAppFlow
from dotenv import load_dotenv
import os
from pathlib import Path

load_dotenv()

SCOPES = ['https://www.googleapis.com/auth/drive.file']

def main():
    client_id = os.getenv("GOOGLE_CLIENT_ID")
    client_secret = os.getenv("GOOGLE_CLIENT_SECRET")
    
    if not client_id or not client_secret:
        print("[ERROR] Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET in .env")
        return
    
    print("=" * 50)
    print("Google Drive Authentication")
    print("=" * 50)
    print()
    print("A browser window will open. Please sign in and authorize the app.")
    print()
    
    client_config = {
        "installed": {
            "client_id": client_id,
            "client_secret": client_secret,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": ["http://localhost:8080/", "http://localhost"]
        }
    }
    
    try:
        flow = InstalledAppFlow.from_client_config(client_config, SCOPES)
        
        # This will print a URL - copy and paste it in your browser
        print("Opening browser for authentication...")
        print("If browser doesn't open, copy and paste the URL that appears below:")
        print()
        
        creds = flow.run_local_server(
            port=8080, 
            open_browser=True,
            success_message="Authentication successful! You can close this window."
        )
        
        # Save the token
        token_path = Path(__file__).parent / "services" / "google_token.json"
        with open(token_path, 'w') as f:
            f.write(creds.to_json())
        
        print()
        print("=" * 50)
        print("[SUCCESS] Authentication completed!")
        print(f"Token saved to: {token_path}")
        print()
        print("You can now restart the main.py server.")
        print("=" * 50)
        
    except Exception as e:
        print(f"[ERROR] Authentication failed: {e}")
        print()
        print("If the browser didn't open, try copying this URL manually:")
        auth_url = f"https://accounts.google.com/o/oauth2/auth?client_id={client_id}&redirect_uri=http://localhost:8080/&scope=https://www.googleapis.com/auth/drive.file&response_type=code&access_type=offline"
        print(auth_url)

if __name__ == "__main__":
    main()
