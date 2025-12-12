# CSMS Backend for Hugging Face Spaces

This backend runs on Hugging Face Spaces (free hosting).

## Deployment Steps

1. Go to [huggingface.co/spaces](https://huggingface.co/spaces) and create account
2. Create new Space with "Docker" SDK
3. Upload all files from `backend/` folder
4. Set environment variables in Space settings:
   - `GOOGLE_DRIVE_FOLDER_ID`
   - `GOOGLE_CREDENTIALS_JSON`
   - `GOOGLE_TOKEN_JSON`
5. Your app will be available at: `https://yourusername-yourspace.hf.space`
