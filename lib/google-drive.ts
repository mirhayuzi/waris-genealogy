import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Google Drive Integration
 * Implements Google Sign-In via OAuth2 and Google Drive REST API
 * for direct CSV backup/restore (Fuelio-style).
 */

const GOOGLE_AUTH_KEY = "@waris_google_auth";
const GOOGLE_USER_KEY = "@waris_google_user";

// Google OAuth2 endpoints
const GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_REVOKE_ENDPOINT = "https://oauth2.googleapis.com/revoke";
const GOOGLE_USERINFO_ENDPOINT = "https://www.googleapis.com/oauth2/v3/userinfo";

// Google Drive API endpoints
const DRIVE_FILES_ENDPOINT = "https://www.googleapis.com/drive/v3/files";
const DRIVE_UPLOAD_ENDPOINT = "https://www.googleapis.com/upload/drive/v3/files";

// Scopes needed for Drive file access
const SCOPES = [
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/userinfo.email",
];

// App folder name on Google Drive
const DRIVE_FOLDER_NAME = "Waris Genealogy";

export interface GoogleUser {
  name: string;
  email: string;
  picture?: string;
}

export interface DriveFile {
  id: string;
  name: string;
  modifiedTime: string;
  size?: string;
}

interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
}

/**
 * Store auth tokens securely
 */
async function storeTokens(tokens: AuthTokens): Promise<void> {
  const value = JSON.stringify(tokens);
  if (Platform.OS !== "web") {
    await SecureStore.setItemAsync(GOOGLE_AUTH_KEY, value);
  } else {
    await AsyncStorage.setItem(GOOGLE_AUTH_KEY, value);
  }
}

/**
 * Get stored auth tokens
 */
async function getStoredTokens(): Promise<AuthTokens | null> {
  try {
    let value: string | null;
    if (Platform.OS !== "web") {
      value = await SecureStore.getItemAsync(GOOGLE_AUTH_KEY);
    } else {
      value = await AsyncStorage.getItem(GOOGLE_AUTH_KEY);
    }
    if (!value) return null;
    return JSON.parse(value) as AuthTokens;
  } catch {
    return null;
  }
}

/**
 * Clear stored tokens
 */
async function clearTokens(): Promise<void> {
  if (Platform.OS !== "web") {
    await SecureStore.deleteItemAsync(GOOGLE_AUTH_KEY);
  } else {
    await AsyncStorage.removeItem(GOOGLE_AUTH_KEY);
  }
  await AsyncStorage.removeItem(GOOGLE_USER_KEY);
}

/**
 * Store user info
 */
async function storeUser(user: GoogleUser): Promise<void> {
  await AsyncStorage.setItem(GOOGLE_USER_KEY, JSON.stringify(user));
}

/**
 * Get stored user info
 */
export async function getStoredUser(): Promise<GoogleUser | null> {
  try {
    const value = await AsyncStorage.getItem(GOOGLE_USER_KEY);
    if (!value) return null;
    return JSON.parse(value) as GoogleUser;
  } catch {
    return null;
  }
}

/**
 * Get a valid access token (refreshing if needed)
 */
export async function getAccessToken(): Promise<string | null> {
  const tokens = await getStoredTokens();
  if (!tokens) return null;

  // Check if token is still valid (with 5 min buffer)
  if (Date.now() < tokens.expiresAt - 300000) {
    return tokens.accessToken;
  }

  // Token expired - try to refresh
  if (tokens.refreshToken) {
    try {
      const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: tokens.refreshToken,
          client_id: await getClientId(),
        }).toString(),
      });

      if (response.ok) {
        const data = await response.json();
        const newTokens: AuthTokens = {
          accessToken: data.access_token,
          refreshToken: tokens.refreshToken,
          expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
        };
        await storeTokens(newTokens);
        return newTokens.accessToken;
      }
    } catch (e) {
      console.error("Token refresh failed:", e);
    }
  }

  // Refresh failed, clear tokens
  await clearTokens();
  return null;
}

/**
 * Get client ID from environment
 */
async function getClientId(): Promise<string> {
  // Try to get from env vars
  const clientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || "";
  return clientId;
}

/**
 * Build the Google OAuth authorization URL
 */
export function getAuthorizationUrl(redirectUri: string, clientId: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
  });
  return `${GOOGLE_AUTH_ENDPOINT}?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string,
  clientId: string,
  codeVerifier?: string,
): Promise<{ tokens: AuthTokens; user: GoogleUser } | null> {
  try {
    const body: Record<string, string> = {
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
    };
    if (codeVerifier) {
      body.code_verifier = codeVerifier;
    }

    const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(body).toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Token exchange failed:", errorText);
      return null;
    }

    const data = await response.json();
    const tokens: AuthTokens = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
    };

    await storeTokens(tokens);

    // Fetch user info
    const user = await fetchUserInfo(tokens.accessToken);
    if (user) {
      await storeUser(user);
    }

    return { tokens, user: user || { name: "Unknown", email: "" } };
  } catch (e) {
    console.error("Code exchange error:", e);
    return null;
  }
}

/**
 * Fetch user info from Google
 */
async function fetchUserInfo(accessToken: string): Promise<GoogleUser | null> {
  try {
    const response = await fetch(GOOGLE_USERINFO_ENDPOINT, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) return null;
    const data = await response.json();
    return {
      name: data.name || data.email || "User",
      email: data.email || "",
      picture: data.picture,
    };
  } catch {
    return null;
  }
}

/**
 * Sign out - revoke token and clear stored data
 */
export async function signOut(): Promise<void> {
  const tokens = await getStoredTokens();
  if (tokens?.accessToken) {
    try {
      await fetch(`${GOOGLE_REVOKE_ENDPOINT}?token=${tokens.accessToken}`, {
        method: "POST",
      });
    } catch {
      // Ignore revocation errors
    }
  }
  await clearTokens();
}

/**
 * Check if user is signed in
 */
export async function isSignedIn(): Promise<boolean> {
  const token = await getAccessToken();
  return token !== null;
}

// ==================== GOOGLE DRIVE API ====================

/**
 * Find or create the Waris Genealogy folder on Drive
 */
async function getOrCreateAppFolder(accessToken: string): Promise<string | null> {
  try {
    // Search for existing folder
    const query = `name='${DRIVE_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    const searchUrl = `${DRIVE_FILES_ENDPOINT}?q=${encodeURIComponent(query)}&fields=files(id,name)`;

    const searchResponse = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (searchResponse.ok) {
      const searchData = await searchResponse.json();
      if (searchData.files && searchData.files.length > 0) {
        return searchData.files[0].id;
      }
    }

    // Create folder if not found
    const createResponse = await fetch(DRIVE_FILES_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: DRIVE_FOLDER_NAME,
        mimeType: "application/vnd.google-apps.folder",
      }),
    });

    if (createResponse.ok) {
      const createData = await createResponse.json();
      return createData.id;
    }

    return null;
  } catch (e) {
    console.error("getOrCreateAppFolder error:", e);
    return null;
  }
}

/**
 * Upload a CSV string to Google Drive
 */
export async function uploadCSVToDrive(
  csvContent: string,
  fileName: string,
): Promise<{ success: boolean; message: string; fileId?: string }> {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    return { success: false, message: "Not signed in to Google. Please sign in first." };
  }

  try {
    const folderId = await getOrCreateAppFolder(accessToken);
    if (!folderId) {
      return { success: false, message: "Failed to create app folder on Google Drive." };
    }

    // Check if file already exists in folder
    const query = `name='${fileName}' and '${folderId}' in parents and trashed=false`;
    const searchUrl = `${DRIVE_FILES_ENDPOINT}?q=${encodeURIComponent(query)}&fields=files(id,name)`;
    const searchResponse = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    let existingFileId: string | null = null;
    if (searchResponse.ok) {
      const searchData = await searchResponse.json();
      if (searchData.files && searchData.files.length > 0) {
        existingFileId = searchData.files[0].id;
      }
    }

    // Build multipart request
    const boundary = "waris_boundary_" + Date.now();
    const metadata = existingFileId
      ? { name: fileName }
      : { name: fileName, parents: [folderId] };

    const multipartBody =
      `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: text/csv\r\n\r\n` +
      `${csvContent}\r\n` +
      `--${boundary}--`;

    let uploadUrl: string;
    let method: string;

    if (existingFileId) {
      // Update existing file
      uploadUrl = `${DRIVE_UPLOAD_ENDPOINT}/${existingFileId}?uploadType=multipart`;
      method = "PATCH";
    } else {
      // Create new file
      uploadUrl = `${DRIVE_UPLOAD_ENDPOINT}?uploadType=multipart`;
      method = "POST";
    }

    const uploadResponse = await fetch(uploadUrl, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body: multipartBody,
    });

    if (uploadResponse.ok) {
      const uploadData = await uploadResponse.json();
      return {
        success: true,
        message: existingFileId ? `Updated ${fileName} on Google Drive` : `Uploaded ${fileName} to Google Drive`,
        fileId: uploadData.id,
      };
    } else {
      const errorText = await uploadResponse.text();
      console.error("Upload failed:", errorText);
      return { success: false, message: `Upload failed: ${uploadResponse.status}` };
    }
  } catch (e: any) {
    console.error("uploadCSVToDrive error:", e);
    return { success: false, message: `Upload error: ${e?.message || "Unknown"}` };
  }
}

/**
 * List CSV files in the Waris Genealogy folder on Drive
 */
export async function listDriveFiles(): Promise<{ success: boolean; files: DriveFile[]; message?: string }> {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    return { success: false, files: [], message: "Not signed in to Google." };
  }

  try {
    const folderId = await getOrCreateAppFolder(accessToken);
    if (!folderId) {
      return { success: false, files: [], message: "Failed to access app folder." };
    }

    const query = `'${folderId}' in parents and trashed=false and mimeType='text/csv'`;
    const url = `${DRIVE_FILES_ENDPOINT}?q=${encodeURIComponent(query)}&fields=files(id,name,modifiedTime,size)&orderBy=modifiedTime desc`;

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (response.ok) {
      const data = await response.json();
      return { success: true, files: data.files || [] };
    } else {
      return { success: false, files: [], message: `Failed to list files: ${response.status}` };
    }
  } catch (e: any) {
    return { success: false, files: [], message: `Error: ${e?.message || "Unknown"}` };
  }
}

/**
 * Download a file from Google Drive by ID
 */
export async function downloadDriveFile(fileId: string): Promise<{ success: boolean; content?: string; message?: string }> {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    return { success: false, message: "Not signed in to Google." };
  }

  try {
    const url = `${DRIVE_FILES_ENDPOINT}/${fileId}?alt=media`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (response.ok) {
      const content = await response.text();
      return { success: true, content };
    } else {
      return { success: false, message: `Download failed: ${response.status}` };
    }
  } catch (e: any) {
    return { success: false, message: `Error: ${e?.message || "Unknown"}` };
  }
}

/**
 * Upload all family data CSVs to Drive
 */
export async function syncAllToDrive(
  membersCSV: string,
  marriagesCSV: string,
  parentChildCSV: string,
): Promise<{ success: boolean; message: string }> {
  const results = await Promise.all([
    uploadCSVToDrive(membersCSV, "members.csv"),
    uploadCSVToDrive(marriagesCSV, "marriages.csv"),
    uploadCSVToDrive(parentChildCSV, "parent-child.csv"),
  ]);

  const allSuccess = results.every((r) => r.success);
  const failedFiles = results.filter((r) => !r.success).map((r) => r.message);

  if (allSuccess) {
    return { success: true, message: "All files synced to Google Drive successfully!" };
  } else {
    return {
      success: false,
      message: `Some files failed to sync: ${failedFiles.join(", ")}`,
    };
  }
}

/**
 * Download all family data CSVs from Drive
 */
export async function downloadAllFromDrive(): Promise<{
  success: boolean;
  membersCSV?: string;
  marriagesCSV?: string;
  parentChildCSV?: string;
  message: string;
}> {
  const listResult = await listDriveFiles();
  if (!listResult.success || listResult.files.length === 0) {
    return {
      success: false,
      message: listResult.files.length === 0
        ? "No backup files found on Google Drive."
        : (listResult.message || "Failed to list files."),
    };
  }

  let membersCSV: string | undefined;
  let marriagesCSV: string | undefined;
  let parentChildCSV: string | undefined;

  for (const file of listResult.files) {
    const download = await downloadDriveFile(file.id);
    if (download.success && download.content) {
      const name = file.name.toLowerCase();
      if (name.includes("member")) {
        membersCSV = download.content;
      } else if (name.includes("marriage")) {
        marriagesCSV = download.content;
      } else if (name.includes("parent")) {
        parentChildCSV = download.content;
      }
    }
  }

  if (!membersCSV) {
    return { success: false, message: "No members.csv found on Google Drive." };
  }

  return {
    success: true,
    membersCSV,
    marriagesCSV,
    parentChildCSV,
    message: "Downloaded backup from Google Drive successfully!",
  };
}
