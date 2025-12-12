"""
Google Drive Integration Service
Uses OAuth2 with credentials file for personal Drive access
"""
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.http import MediaInMemoryUpload
import os
import json
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

SCOPES = ['https://www.googleapis.com/auth/drive.file']

class GoogleDriveService:
    def __init__(self):
        self.folder_id = os.getenv("GOOGLE_DRIVE_FOLDER_ID", "")
        self.credentials_file = Path(__file__).parent / "google_credentials.json"
        self.token_file = Path(__file__).parent / "google_token.json"
        self.service = None
        self.enabled = False
        self.folders_cache = {}
        
        print("[INFO] Initializing Google Drive Service (OAuth2)...")
        print(f"  Folder ID: {self.folder_id[:20] if self.folder_id else 'Not set'}...")
        print(f"  Credentials file exists: {self.credentials_file.exists()}")
        print(f"  Token file exists: {self.token_file.exists()}")
        
        if self.folder_id and self.credentials_file.exists():
            try:
                self.service = self._get_drive_service()
                self.enabled = bool(self.service)
                if self.enabled:
                    print("[OK] Google Drive service initialized!")
            except Exception as e:
                print(f"[ERROR] Google Drive initialization failed: {e}")
                self.enabled = False
        else:
            print("[WARN] Google Drive not configured.")
    
    def _get_drive_service(self):
        """Get Google Drive service using OAuth2"""
        creds = None
        
        # Load existing token
        if self.token_file.exists():
            try:
                creds = Credentials.from_authorized_user_file(str(self.token_file), SCOPES)
                print("[INFO] Loaded existing token")
            except Exception as e:
                print(f"[WARN] Could not load token: {e}")
        
        # Refresh or get new token
        if not creds or not creds.valid:
            if creds and creds.expired and creds.refresh_token:
                print("[INFO] Refreshing expired token...")
                creds.refresh(Request())
            else:
                print("[AUTH] Starting OAuth2 flow...")
                flow = InstalledAppFlow.from_client_secrets_file(
                    str(self.credentials_file),
                    SCOPES
                )
                creds = flow.run_local_server(port=0)
            
            # Save token
            with open(self.token_file, 'w') as token:
                token.write(creds.to_json())
                print(f"[OK] Token saved")
        
        return build('drive', 'v3', credentials=creds)
    
    def find_or_create_folder(self, folder_name: str, parent_id: str = None) -> str:
        """Find existing folder or create new one by name"""
        if not self.enabled or not self.service:
            print("[WARN] Drive not enabled")
            return None
        
        try:
            parent_id = parent_id or self.folder_id
            
            # Check cache
            cache_key = f"{parent_id}:{folder_name}"
            if cache_key in self.folders_cache:
                print(f"[CACHE] Using cached folder: {folder_name}")
                return self.folders_cache[cache_key]
            
            # Search for existing folder
            query = f"name='{folder_name}' and '{parent_id}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false"
            results = self.service.files().list(q=query, spaces='drive', fields='files(id, name)').execute()
            files = results.get('files', [])
            
            if files:
                folder_id = files[0]['id']
                self.folders_cache[cache_key] = folder_id
                print(f"[FOUND] Existing folder: {folder_name}")
                return folder_id
            
            # Create new folder
            file_metadata = {
                'name': folder_name,
                'mimeType': 'application/vnd.google-apps.folder',
                'parents': [parent_id]
            }
            file = self.service.files().create(body=file_metadata, fields='id').execute()
            folder_id = file.get('id')
            self.folders_cache[cache_key] = folder_id
            print(f"[CREATED] New folder: {folder_name}")
            return folder_id
            
        except Exception as e:
            print(f"[ERROR] Error finding/creating folder: {e}")
            return None

    async def upload_file_to_drive(self, file_data: bytes, filename: str, project_name: str) -> bool:
        """Upload file to Google Drive folder (auto-creates project folder)"""
        if not self.enabled or not self.service:
            print("[WARN] Google Drive not enabled")
            return False
        
        try:
            # 1. Find or Create Project Folder
            project_folder_id = self.find_or_create_folder(project_name)
            if not project_folder_id:
                print("[ERROR] Could not get project folder ID")
                return False

            # 2. Upload File to that folder
            file_metadata = {
                'name': filename,
                'parents': [project_folder_id]
            }
            
            media = MediaInMemoryUpload(file_data, resumable=True)
            
            file = self.service.files().create(
                body=file_metadata,
                media_body=media,
                fields='id'
            ).execute()
            
            print(f"[OK] File uploaded to Google Drive: {project_name}/{filename}")
            return True
            
        except Exception as e:
            print(f"[ERROR] Error uploading to Google Drive: {e}")
            return False

    def find_file_in_folder(self, filename: str, project_name: str) -> str:
        """Find a file by name in a project folder"""
        if not self.enabled or not self.service:
            return None
        
        try:
            # First find project folder
            project_folder_id = self.find_or_create_folder(project_name)
            if not project_folder_id:
                return None
            
            # Search for file
            query = f"name='{filename}' and '{project_folder_id}' in parents and trashed=false"
            results = self.service.files().list(q=query, spaces='drive', fields='files(id, name, mimeType)').execute()
            files = results.get('files', [])
            
            if files:
                return files[0]['id']
            return None
            
        except Exception as e:
            print(f"[ERROR] Error finding file: {e}")
            return None
    
    def download_file(self, file_id: str) -> bytes:
        """Download a file from Google Drive by ID"""
        if not self.enabled or not self.service:
            return None
        
        try:
            from googleapiclient.http import MediaIoBaseDownload
            import io
            
            request = self.service.files().get_media(fileId=file_id)
            buffer = io.BytesIO()
            downloader = MediaIoBaseDownload(buffer, request)
            
            done = False
            while not done:
                status, done = downloader.next_chunk()
            
            buffer.seek(0)
            return buffer.read()
            
        except Exception as e:
            print(f"[ERROR] Error downloading file: {e}")
            return None
    
    def get_files_in_project(self, project_name: str) -> list:
        """Get all files in a project folder"""
        if not self.enabled or not self.service:
            return []
        
        try:
            project_folder_id = self.find_or_create_folder(project_name)
            if not project_folder_id:
                return []
            
            query = f"'{project_folder_id}' in parents and trashed=false and mimeType!='application/vnd.google-apps.folder'"
            results = self.service.files().list(q=query, spaces='drive', fields='files(id, name, mimeType)').execute()
            return results.get('files', [])
            
        except Exception as e:
            print(f"[ERROR] Error listing files: {e}")
            return []
    
    def export_file_as_pdf(self, file_id: str) -> bytes:
        """Export a Google Workspace file (Docs, Sheets, Slides) as PDF"""
        if not self.enabled or not self.service:
            return None
        
        try:
            request = self.service.files().export_media(
                fileId=file_id,
                mimeType='application/pdf'
            )
            from googleapiclient.http import MediaIoBaseDownload
            import io
            
            buffer = io.BytesIO()
            downloader = MediaIoBaseDownload(buffer, request)
            
            done = False
            while not done:
                status, done = downloader.next_chunk()
            
            buffer.seek(0)
            return buffer.read()
            
        except Exception as e:
            print(f"[ERROR] Error exporting file as PDF: {e}")
            return None
    
    def get_file_info(self, file_id: str) -> dict:
        """Get file metadata including mimeType"""
        if not self.enabled or not self.service:
            return None
        
        try:
            file = self.service.files().get(fileId=file_id, fields='id, name, mimeType').execute()
            return file
        except Exception as e:
            print(f"[ERROR] Error getting file info: {e}")
            return None

    def convert_office_to_pdf(self, file_id: str, filename: str) -> bytes:
        """Convert an uploaded Office file to PDF using Google Drive conversion
        
        This works by:
        1. Making a copy of the file with Google's conversion (imports to Google format)
        2. Exporting that copy as PDF
        3. Deleting the temporary copy
        """
        if not self.enabled or not self.service:
            return None
        
        file_ext = filename.lower().split('.')[-1] if '.' in filename else ''
        
        # Map Office extensions to Google import types
        google_mime_types = {
            'docx': 'application/vnd.google-apps.document',
            'doc': 'application/vnd.google-apps.document',
            'xlsx': 'application/vnd.google-apps.spreadsheet',
            'xls': 'application/vnd.google-apps.spreadsheet',
            'pptx': 'application/vnd.google-apps.presentation',
            'ppt': 'application/vnd.google-apps.presentation',
        }
        
        target_mime = google_mime_types.get(file_ext)
        if not target_mime:
            print(f"[WARN] Unsupported file type for conversion: {file_ext}")
            return None
        
        temp_file_id = None
        try:
            # Step 1: Copy the file and convert to Google format
            copy_metadata = {
                'name': f'_temp_convert_{filename}',
                'mimeType': target_mime
            }
            copied_file = self.service.files().copy(
                fileId=file_id,
                body=copy_metadata
            ).execute()
            temp_file_id = copied_file.get('id')
            print(f"[INFO] Created temp Google file: {temp_file_id}")
            
            # Step 2: Export as PDF
            from googleapiclient.http import MediaIoBaseDownload
            import io
            
            request = self.service.files().export_media(
                fileId=temp_file_id,
                mimeType='application/pdf'
            )
            
            buffer = io.BytesIO()
            downloader = MediaIoBaseDownload(buffer, request)
            
            done = False
            while not done:
                status, done = downloader.next_chunk()
            
            buffer.seek(0)
            pdf_bytes = buffer.read()
            print(f"[OK] Converted {filename} to PDF ({len(pdf_bytes)} bytes)")
            
            return pdf_bytes
            
        except Exception as e:
            print(f"[ERROR] Error converting Office to PDF: {e}")
            return None
            
        finally:
            # Step 3: Delete the temporary file
            if temp_file_id:
                try:
                    self.service.files().delete(fileId=temp_file_id).execute()
                    print(f"[INFO] Deleted temp file: {temp_file_id}")
                except Exception as e:
                    print(f"[WARN] Could not delete temp file: {e}")
