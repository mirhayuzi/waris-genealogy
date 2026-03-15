# Google Drive Integration Research

## Approach: expo-auth-session + Google Drive REST API

### How Fuelio does it:
1. Shows a "Google Drive Backup" screen with "Sign In" button (Google branded)
2. User signs in via Google OAuth
3. After sign in, shows "Signed In: [user name]" with "SIGN OUT" button
4. "SEND TO GOOGLE DRIVE" button uploads CSV directly to Drive
5. "DOWNLOAD FROM GOOGLE DRIVE" button downloads CSV from Drive
6. No share sheet involved - direct API calls

### Implementation Plan:
1. Use `expo-auth-session` with Google OAuth2 endpoints
2. Request scopes: `https://www.googleapis.com/auth/drive.file` (create/manage files app created)
3. Get access_token from OAuth flow
4. Use Google Drive REST API v3 to:
   - Upload: POST to `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`
   - Download: GET from `https://www.googleapis.com/drive/v3/files/{fileId}?alt=media`
   - List: GET from `https://www.googleapis.com/drive/v3/files` with query
5. Store access token in SecureStore for persistence
6. No need for client_secret since we use PKCE flow

### Google OAuth2 Endpoints:
- Authorization: `https://accounts.google.com/o/oauth2/v2/auth`
- Token: `https://oauth2.googleapis.com/token`
- Revocation: `https://oauth2.googleapis.com/revoke`
- User info: `https://www.googleapis.com/oauth2/v3/userinfo`

### Key: Need a Google OAuth Client ID
- This is a web client ID from Google Cloud Console
- User needs to provide this OR we use expo-auth-session's proxy
- For production: need proper OAuth consent screen setup

### Alternative: Use expo-auth-session with Google discovery
- Google discovery URL: `https://accounts.google.com/.well-known/openid-configuration`
- Can use `useAutoDiscovery` for Google endpoints
