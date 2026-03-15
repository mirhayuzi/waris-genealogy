# OAuth Fix Notes

## Problem
Google OAuth "Web application" client type requires HTTPS redirect URIs.
Our app uses custom scheme `manus20260312144942://` which is NOT HTTPS.
Google blocks the request with "Error 400: invalid_request".

## Expo Official Recommendation
Expo recommends `@react-native-google-signin/google-signin` for Google auth.
However, it requires custom native code and config plugin — can't be used in Expo Go.
It needs SHA-1 fingerprint from the APK signing key.

## Better Approach for Our Case
Since we're using expo-auth-session (browser-based OAuth), the correct setup is:

For **Web application** client type in Google Cloud Console:
- Authorized JavaScript origins: not needed for mobile
- Authorized redirect URIs: must be HTTPS

For **Android** client type:
- Uses SHA-1 fingerprint + package name
- No redirect URI configuration needed
- But expo-auth-session doesn't use this type

## Solution: Create a Web client with correct redirect URI
The `makeRedirectUri` with `scheme` generates: `manus20260312144942://`
For standalone builds, this is the redirect URI.

Google Web clients ONLY accept HTTPS redirect URIs.
So we need to either:
1. Use an Android client type (requires native google-signin library)
2. Use our own server as a proxy to handle the OAuth redirect

## Chosen: Use our backend server as OAuth proxy
Since we have a backend server, we can:
1. Create an endpoint on our server that handles the OAuth flow
2. Server uses Web client credentials (client_id + client_secret)
3. Server redirects back to the app via custom scheme
4. This way Google sees HTTPS redirect to our server
