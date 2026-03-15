import { Text, View, Pressable, ScrollView, Alert, Switch, Platform, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useFamily } from "@/lib/family-store";
import { useI18n } from "@/lib/i18n";
import { useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { FamilyData } from "@/lib/types";
import { exportFamilyDataAsCSV } from "@/lib/csv-export";
import { parseMembersCSV, parseMarriagesCSV, parseParentChildCSV, buildFamilyDataFromCSV } from "@/lib/csv-import";
import {
  GoogleUser,
  getStoredUser,
  getAccessToken,
  signOut as googleSignOut,
  syncAllToDrive,
  downloadAllFromDrive,
  storeServerTokens,
} from "@/lib/google-drive";
import { getApiBaseUrl } from "@/constants/oauth";
import * as Linking from "expo-linking";

// Lazy-load native modules
let FileSystem: any = null;
let DocumentPicker: any = null;
let WebBrowser: any = null;

try { FileSystem = require("expo-file-system/legacy"); } catch {}
try { DocumentPicker = require("expo-document-picker"); } catch {}
try { WebBrowser = require("expo-web-browser"); } catch {}

const BACKUP_DATE_KEY = "@waris_last_backup";
const BACKUP_AUTO_KEY = "@waris_auto_backup";
const BACKUP_WIFI_KEY = "@waris_wifi_only";
const GOOGLE_CLIENT_ID_KEY = "@waris_google_client_id";

export default function BackupRestoreScreen() {
  const router = useRouter();
  const colors = useColors();
  const { data } = useFamily();
  const { t, lang } = useI18n();

  // Google Sign-In state
  const [googleUser, setGoogleUser] = useState<GoogleUser | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  // Backup/Restore state
  const [sending, setSending] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [lastBackup, setLastBackup] = useState<string | null>(null);
  const [autoBackup, setAutoBackup] = useState(false);
  const [wifiOnly, setWifiOnly] = useState(true);

  // Load saved state
  useEffect(() => {
    AsyncStorage.getItem(BACKUP_DATE_KEY).then((d) => { if (d) setLastBackup(d); });
    AsyncStorage.getItem(BACKUP_AUTO_KEY).then((d) => { if (d === "true") setAutoBackup(true); });
    AsyncStorage.getItem(BACKUP_WIFI_KEY).then((d) => { if (d !== "false") setWifiOnly(true); });
    // Check if already signed in
    getStoredUser().then((user) => { if (user) setGoogleUser(user); });
  }, []);

  const toggleAutoBackup = (val: boolean) => {
    setAutoBackup(val);
    AsyncStorage.setItem(BACKUP_AUTO_KEY, String(val));
  };

  const toggleWifiOnly = (val: boolean) => {
    setWifiOnly(val);
    AsyncStorage.setItem(BACKUP_WIFI_KEY, String(val));
  };

  // ==================== GOOGLE SIGN-IN ====================

  const getClientId = useCallback(async (): Promise<string> => {
    // Check env var first
    const envClientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
    if (envClientId) return envClientId;
    // Check stored value
    const stored = await AsyncStorage.getItem(GOOGLE_CLIENT_ID_KEY);
    if (stored) return stored;
    return "";
  }, []);

  const handleGoogleSignIn = async () => {
    const clientId = await getClientId();
    if (!clientId) {
      Alert.alert(
        lang === "bm" ? "Konfigurasi Diperlukan" : "Configuration Required",
        lang === "bm"
          ? "Google Client ID diperlukan untuk log masuk Google Drive. Sila hubungi pembangun aplikasi."
          : "Google Client ID is required for Google Drive sign-in. Please contact the app developer.",
      );
      return;
    }

    setSigningIn(true);
    try {
      // Use server-side HTTPS redirect URI for Google OAuth
      // Google requires HTTPS redirect URIs for web-type OAuth clients.
      // Our server at /api/google/callback receives the code and redirects
      // back to the app via custom scheme.
      const apiBase = getApiBaseUrl();
      const serverRedirectUri = `${apiBase}/api/google/callback`;

      // Build Google OAuth URL manually (no expo-auth-session needed)
      const scopes = [
        "https://www.googleapis.com/auth/drive.file",
        "https://www.googleapis.com/auth/userinfo.profile",
        "https://www.googleapis.com/auth/userinfo.email",
      ].join(" ");

      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${encodeURIComponent(clientId)}` +
        `&redirect_uri=${encodeURIComponent(serverRedirectUri)}` +
        `&response_type=code` +
        `&scope=${encodeURIComponent(scopes)}` +
        `&access_type=offline` +
        `&prompt=consent`;

      // Set up deep link listener to catch the callback
      const handleDeepLink = async (event: { url: string }) => {
        const url = event.url;
        if (!url.includes("google-callback")) return;

        // Remove listener
        linkSubscription.remove();

        // Parse tokens from the URL (server already exchanged the code)
        const urlObj = new URL(url);
        const accessToken = urlObj.searchParams.get("access_token");
        const refreshToken = urlObj.searchParams.get("refresh_token");
        const expiresIn = urlObj.searchParams.get("expires_in");
        const error = urlObj.searchParams.get("error");

        if (error) {
          Alert.alert(
            lang === "bm" ? "Ralat" : "Error",
            `Google sign-in error: ${error}`,
          );
          setSigningIn(false);
          return;
        }

        if (accessToken) {
          // Server already exchanged the code for tokens — just store them
          const user = await storeServerTokens({
            accessToken,
            refreshToken: refreshToken || undefined,
            expiresIn: parseInt(expiresIn || "3600", 10),
          });

          if (user) {
            setGoogleUser(user);
            Alert.alert(
              lang === "bm" ? "Berjaya!" : "Success!",
              lang === "bm"
                ? `Log masuk sebagai ${user.name}`
                : `Signed in as ${user.name}`,
            );
          } else {
            Alert.alert(
              lang === "bm" ? "Ralat" : "Error",
              lang === "bm" ? "Gagal mendapatkan maklumat pengguna." : "Failed to get user info.",
            );
          }
        }
        setSigningIn(false);
      };

      // Listen for deep link callback
      const linkSubscription = Linking.addEventListener("url", handleDeepLink);

      // Open the Google OAuth URL in the system browser
      if (WebBrowser) {
        await WebBrowser.openBrowserAsync(authUrl, {
          showInRecents: true,
          createTask: false,
        });
      } else {
        await Linking.openURL(authUrl);
      }

      // Set a timeout to clean up if user doesn't complete sign-in
      setTimeout(() => {
        linkSubscription.remove();
        setSigningIn(false);
      }, 120000); // 2 minute timeout
    } catch (e: any) {
      console.error("Google Sign-In error:", e);
      Alert.alert(
        lang === "bm" ? "Ralat" : "Error",
        `Sign-in failed: ${e?.message || "Unknown error"}`,
      );
      setSigningIn(false);
    }
  };

  const handleGoogleSignOut = async () => {
    setSigningOut(true);
    try {
      await googleSignOut();
      setGoogleUser(null);
    } catch (e: any) {
      console.error("Sign-out error:", e);
    } finally {
      setSigningOut(false);
    }
  };

  // ==================== CSV GENERATION ====================

  const buildMembersCSVString = (): string => {
    const escapeCSV = (value: string) => {
      if (value === null || value === undefined) return '""';
      const s = String(value);
      if (s.includes(",") || s.includes('"') || s.includes("\n")) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };
    const headers = ["ID", "First Name", "Last Name", "Prefix/Title", "Bin/Binti", "Gender", "Date of Birth", "Place of Birth", "Date of Death", "Status", "Ethnicity/Race", "Religion", "Photo File", "Biography"];
    const rows = data.persons.map((m) => [
      m.id, m.firstName, m.lastName || "", m.prefix || "", m.binBinti || "",
      m.gender, m.birthDate || "", m.birthPlace || "", m.deathDate || "",
      m.isAlive ? "Living" : "Deceased", m.race || "", m.religion || "",
      m.photo ? `photos/${m.id}.jpg` : "", m.bio || "",
    ]);
    return [headers.map(escapeCSV).join(","), ...rows.map((r) => r.map(escapeCSV).join(","))].join("\n");
  };

  const buildMarriagesCSVString = (): string => {
    const escapeCSV = (value: string) => {
      if (value === null || value === undefined) return '""';
      const s = String(value);
      if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const headers = ["Marriage ID", "Husband ID", "Wife ID", "Marriage Date", "Marriage Place", "Divorce Date", "Status", "Notes"];
    const rows = data.marriages.map((m) => [
      m.id, m.husbandId, m.wifeId, m.marriageDate || "", m.marriagePlace || "",
      m.divorceDate || "", m.isActive ? "Active" : "Divorced", m.notes || "",
    ]);
    return [headers.map(escapeCSV).join(","), ...rows.map((r) => r.map(escapeCSV).join(","))].join("\n");
  };

  const buildParentChildCSVString = (): string => {
    const escapeCSV = (value: string) => {
      if (value === null || value === undefined) return '""';
      const s = String(value);
      if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const headers = ["Relationship ID", "Parent ID", "Child ID", "Relationship Type"];
    const rows = data.parentChildren.map((r) => [r.id, r.parentId, r.childId, r.type]);
    return [headers.map(escapeCSV).join(","), ...rows.map((r) => r.map(escapeCSV).join(","))].join("\n");
  };

  // ==================== SEND TO GOOGLE DRIVE ====================

  const handleSendToDrive = async () => {
    if (!googleUser) {
      Alert.alert(
        lang === "bm" ? "Log Masuk Diperlukan" : "Sign In Required",
        lang === "bm" ? "Sila log masuk ke Google terlebih dahulu." : "Please sign in to Google first.",
      );
      return;
    }
    if (data.persons.length === 0) {
      Alert.alert(
        lang === "bm" ? "Tiada Data" : "No Data",
        lang === "bm" ? "Sila tambah ahli keluarga sebelum menyegerakkan." : "Please add family members before syncing.",
      );
      return;
    }

    setSending(true);
    try {
      const membersCSV = buildMembersCSVString();
      const marriagesCSV = buildMarriagesCSVString();
      const parentChildCSV = buildParentChildCSVString();

      const result = await syncAllToDrive(membersCSV, marriagesCSV, parentChildCSV);

      if (result.success) {
        const now = new Date().toLocaleString("en-MY");
        await AsyncStorage.setItem(BACKUP_DATE_KEY, now);
        setLastBackup(now);
        Alert.alert(
          lang === "bm" ? "Berjaya!" : "Success!",
          lang === "bm"
            ? "Semua fail CSV telah dimuat naik ke Google Drive dalam folder 'Waris Genealogy'."
            : "All CSV files uploaded to Google Drive in 'Waris Genealogy' folder.",
        );
      } else {
        Alert.alert(lang === "bm" ? "Ralat" : "Error", result.message);
      }
    } catch (e: any) {
      console.error("Send to Drive error:", e);
      Alert.alert(lang === "bm" ? "Ralat" : "Error", `Failed: ${e?.message || "Unknown"}`);
    } finally {
      setSending(false);
    }
  };

  // ==================== DOWNLOAD FROM GOOGLE DRIVE ====================

  const handleDownloadFromDrive = async () => {
    if (!googleUser) {
      Alert.alert(
        lang === "bm" ? "Log Masuk Diperlukan" : "Sign In Required",
        lang === "bm" ? "Sila log masuk ke Google terlebih dahulu." : "Please sign in to Google first.",
      );
      return;
    }

    setDownloading(true);
    try {
      const result = await downloadAllFromDrive();

      if (result.success && result.membersCSV) {
        const persons = parseMembersCSV(result.membersCSV);
        const marriages = result.marriagesCSV ? parseMarriagesCSV(result.marriagesCSV) : [];
        const parentChildren = result.parentChildCSV ? parseParentChildCSV(result.parentChildCSV) : [];

        if (persons.length === 0) {
          Alert.alert(
            lang === "bm" ? "Tiada Data" : "No Data",
            lang === "bm" ? "Tiada ahli keluarga ditemui dalam sandaran Google Drive." : "No family members found in Google Drive backup.",
          );
          setDownloading(false);
          return;
        }

        const familyData = buildFamilyDataFromCSV(persons, marriages, parentChildren, data.familyName, undefined);
        confirmRestore(familyData);
      } else {
        Alert.alert(
          lang === "bm" ? "Ralat" : "Error",
          result.message || (lang === "bm" ? "Gagal memuat turun dari Google Drive." : "Failed to download from Google Drive."),
        );
      }
    } catch (e: any) {
      console.error("Download from Drive error:", e);
      Alert.alert(lang === "bm" ? "Ralat" : "Error", `Failed: ${e?.message || "Unknown"}`);
    } finally {
      setDownloading(false);
    }
  };

  // ==================== LOCAL EXPORT/IMPORT ====================

  const handleExportLocal = async () => {
    if (data.persons.length === 0) {
      Alert.alert(
        lang === "bm" ? "Tiada Data" : "No Data",
        lang === "bm" ? "Sila tambah ahli keluarga sebelum mengeksport." : "Please add family members before exporting.",
      );
      return;
    }
    setExporting(true);
    try {
      if (Platform.OS === "web") {
        // Web: download via browser
        const membersCSV = buildMembersCSVString();
        const blob = new Blob([membersCSV], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `waris-backup-${new Date().toISOString().split("T")[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        Alert.alert(lang === "bm" ? "Berjaya" : "Success", lang === "bm" ? "Fail CSV dimuat turun." : "CSV file downloaded.");
      } else if (FileSystem) {
        // Native: Use SAF to let user choose save location first
        const { StorageAccessFramework } = FileSystem;

        // Step 1: Ask user to pick a folder
        const permissions = await StorageAccessFramework.requestDirectoryPermissionsAsync();
        if (!permissions.granted) {
          // User cancelled the folder picker
          setExporting(false);
          return;
        }

        const dirUri = permissions.directoryUri;

        // Step 2: Generate CSV content
        const membersCSV = buildMembersCSVString();
        const marriagesCSV = buildMarriagesCSVString();
        const parentChildCSV = buildParentChildCSVString();

        // Step 3: Create and write each CSV file in the chosen directory
        const dateStr = new Date().toISOString().split("T")[0];
        let filesCreated = 0;

        // Members CSV
        const membersUri = await StorageAccessFramework.createFileAsync(
          dirUri,
          `waris-members-${dateStr}`,
          "text/csv",
        );
        await FileSystem.writeAsStringAsync(membersUri, membersCSV, {
          encoding: FileSystem.EncodingType.UTF8,
        });
        filesCreated++;

        // Marriages CSV
        if (data.marriages.length > 0) {
          const marriagesUri = await StorageAccessFramework.createFileAsync(
            dirUri,
            `waris-marriages-${dateStr}`,
            "text/csv",
          );
          await FileSystem.writeAsStringAsync(marriagesUri, marriagesCSV, {
            encoding: FileSystem.EncodingType.UTF8,
          });
          filesCreated++;
        }

        // Parent-Child CSV
        if (data.parentChildren.length > 0) {
          const parentChildUri = await StorageAccessFramework.createFileAsync(
            dirUri,
            `waris-parent-child-${dateStr}`,
            "text/csv",
          );
          await FileSystem.writeAsStringAsync(parentChildUri, parentChildCSV, {
            encoding: FileSystem.EncodingType.UTF8,
          });
          filesCreated++;
        }

        Alert.alert(
          lang === "bm" ? "Berjaya!" : "Success!",
          lang === "bm"
            ? `${filesCreated} fail CSV berjaya disimpan ke lokasi yang dipilih.`
            : `${filesCreated} CSV file(s) saved to the selected location.`,
        );
      } else {
        // Fallback: save to app storage
        const result = await exportFamilyDataAsCSV(data.persons, data.marriages, data.parentChildren);
        if (result.success) {
          Alert.alert(
            lang === "bm" ? "Berjaya" : "Success",
            lang === "bm"
              ? "Fail CSV disimpan dalam storan aplikasi."
              : "CSV files saved to app storage.",
          );
        }
      }
    } catch (e: any) {
      Alert.alert(lang === "bm" ? "Ralat" : "Error", `Export failed: ${e?.message || "Unknown"}`);
    } finally {
      setExporting(false);
    }
  };

  const handleImportLocal = async () => {
    if (!DocumentPicker && Platform.OS !== "web") {
      Alert.alert(lang === "bm" ? "Ralat" : "Error", lang === "bm" ? "Pemilih dokumen tidak tersedia." : "Document picker not available.");
      return;
    }
    setImporting(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["text/csv", "text/comma-separated-values", "application/json", "*/*"],
        copyToCacheDirectory: true,
        multiple: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        setImporting(false);
        return;
      }

      let allPersons: any[] = [];
      let allMarriages: any[] = [];
      let allParentChildren: any[] = [];
      let foundJSON = false;

      for (const asset of result.assets) {
        let content: string;
        if (Platform.OS === "web" && asset.file) {
          content = await asset.file.text();
        } else if (FileSystem) {
          content = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.UTF8 });
        } else {
          continue;
        }

        const trimmed = content.trim();
        if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
          try {
            const parsed = JSON.parse(content) as FamilyData;
            if (parsed.persons && Array.isArray(parsed.persons)) {
              confirmRestore(parsed);
              foundJSON = true;
              break;
            }
          } catch {}
          continue;
        }

        const fileName = (asset.name || "").toLowerCase();
        const firstLine = content.split("\n")[0]?.toLowerCase() || "";
        if (fileName.includes("marriage") || firstLine.includes("marriage id") || firstLine.includes("husband id")) {
          allMarriages = parseMarriagesCSV(content);
        } else if (fileName.includes("parent") || firstLine.includes("relationship id") || firstLine.includes("parent id")) {
          allParentChildren = parseParentChildCSV(content);
        } else {
          allPersons = parseMembersCSV(content);
        }
      }

      if (foundJSON) { setImporting(false); return; }

      if (allPersons.length === 0) {
        Alert.alert(
          lang === "bm" ? "Fail Tidak Sah" : "Invalid File",
          lang === "bm" ? "Tiada data keluarga ditemui." : "No family data found in selected files.",
        );
        setImporting(false);
        return;
      }

      const familyData = buildFamilyDataFromCSV(allPersons, allMarriages, allParentChildren, data.familyName, undefined);
      confirmRestore(familyData);
    } catch (e: any) {
      Alert.alert(lang === "bm" ? "Ralat" : "Error", `Import failed: ${e?.message || "Unknown"}`);
    } finally {
      setImporting(false);
    }
  };

  // ==================== RESTORE ====================

  const confirmRestore = (parsed: FamilyData) => {
    Alert.alert(
      lang === "bm" ? "Pulihkan Data" : "Restore Data",
      lang === "bm"
        ? `Dijumpai ${parsed.persons.length} ahli dan ${parsed.marriages?.length || 0} perkahwinan.\n\nIni akan menggantikan SEMUA data semasa. Teruskan?`
        : `Found ${parsed.persons.length} members and ${parsed.marriages?.length || 0} marriages.\n\nThis will replace ALL current data. Continue?`,
      [
        { text: t("cancel"), style: "cancel" },
        {
          text: lang === "bm" ? "Pulihkan" : "Restore",
          style: "destructive",
          onPress: async () => {
            try {
              await AsyncStorage.setItem("@waris_family_data", JSON.stringify(parsed));
              Alert.alert(
                lang === "bm" ? "Dipulihkan" : "Restored",
                lang === "bm"
                  ? `Berjaya memulihkan ${parsed.persons.length} ahli.\n\nSila mulakan semula aplikasi.`
                  : `Successfully restored ${parsed.persons.length} members.\n\nPlease restart the app to see changes.`,
              );
            } catch {
              Alert.alert(lang === "bm" ? "Ralat" : "Error", lang === "bm" ? "Gagal memulihkan data." : "Failed to restore data.");
            }
          },
        },
      ],
    );
  };

  // ==================== RENDER ====================

  const isSignedIn = !!googleUser;

  return (
    <ScreenContainer className="pt-2">
      {/* Header */}
      <View className="flex-row items-center px-5 mb-4 gap-3">
        <Pressable onPress={() => router.back()} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
          <View className="flex-row items-center gap-1">
            <IconSymbol name="chevron.left" size={20} color={colors.primary} />
            <Text className="text-sm" style={{ color: colors.primary }}>{t("back")}</Text>
          </View>
        </Pressable>
        <Text className="text-xl font-bold text-foreground flex-1">
          {lang === "bm" ? "Sandaran Google Drive" : "Google Drive Backup"}
        </Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>

        {/* ===== GOOGLE SIGN-IN SECTION (Fuelio-style) ===== */}
        {isSignedIn ? (
          <>
            {/* Sign Out Button */}
            <Pressable
              onPress={handleGoogleSignOut}
              disabled={signingOut}
              style={({ pressed }) => [{ opacity: signingOut ? 0.5 : pressed ? 0.8 : 1 }]}
            >
              <View className="rounded-xl py-3.5 items-center mb-1" style={{ backgroundColor: "#DB4437" }}>
                <Text className="text-sm font-bold text-white tracking-wide">
                  {signingOut
                    ? (lang === "bm" ? "LOG KELUAR..." : "SIGNING OUT...")
                    : (lang === "bm" ? "LOG KELUAR" : "SIGN OUT")
                  }
                </Text>
              </View>
            </Pressable>
            {/* Signed-in user info */}
            <View className="items-center py-2 mb-5">
              <Text className="text-xs text-muted">
                {lang === "bm" ? "Log Masuk Sebagai:" : "Signed In:"} {googleUser.name}
              </Text>
              {googleUser.email ? (
                <Text className="text-[10px] text-muted">{googleUser.email}</Text>
              ) : null}
            </View>
          </>
        ) : (
          <>
            {/* Sign In Section - Fuelio style */}
            <View className="items-center py-10 mb-4">
              {/* App icon → Drive icon */}
              <View className="flex-row items-center gap-4 mb-6">
                <View className="w-16 h-16 rounded-2xl items-center justify-center" style={{ backgroundColor: colors.primary + "15" }}>
                  <IconSymbol name="person.3.fill" size={28} color={colors.primary} />
                </View>
                <Text className="text-2xl text-muted">→</Text>
                <View className="w-16 h-16 rounded-2xl items-center justify-center" style={{ backgroundColor: "#4285F4" + "15" }}>
                  <IconSymbol name="arrow.down.doc.fill" size={28} color="#4285F4" />
                </View>
              </View>
              <Text className="text-base font-semibold text-foreground mb-2">
                {lang === "bm" ? "Sandaran Google Drive" : "Google Drive Backup"}
              </Text>
              <Text className="text-xs text-muted text-center px-8 mb-6">
                {lang === "bm"
                  ? "Log masuk dengan akaun Google anda untuk menyegerakkan data keluarga ke Google Drive."
                  : "Sign in with your Google account to sync family data to Google Drive."
                }
              </Text>

              {/* Google Sign In Button */}
              <Pressable
                onPress={handleGoogleSignIn}
                disabled={signingIn}
                style={({ pressed }) => [{ opacity: signingIn ? 0.6 : pressed ? 0.8 : 1 }]}
              >
                <View
                  className="flex-row items-center rounded-lg px-6 py-3 gap-3"
                  style={{
                    backgroundColor: "#fff",
                    borderWidth: 1,
                    borderColor: "#dadce0",
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.1,
                    shadowRadius: 2,
                    elevation: 2,
                  }}
                >
                  {signingIn ? (
                    <ActivityIndicator size="small" color="#4285F4" />
                  ) : (
                    <Text className="text-lg font-bold" style={{ color: "#4285F4" }}>G</Text>
                  )}
                  <Text className="text-sm font-medium" style={{ color: "#3c4043" }}>
                    {signingIn
                      ? (lang === "bm" ? "Log Masuk..." : "Signing In...")
                      : (lang === "bm" ? "Log Masuk" : "Sign In")
                    }
                  </Text>
                </View>
              </Pressable>
            </View>
          </>
        )}

        {/* ===== SYNCHRONIZE SECTION ===== */}
        {isSignedIn && (
          <>
            <Text className="text-xs font-bold text-muted uppercase tracking-widest mb-1">
              {lang === "bm" ? "SEGERAKKAN" : "SYNCHRONIZE"}
            </Text>
            <Text className="text-xs text-muted mb-4">
              {lang === "bm"
                ? "Segerakkan semua fail keluarga anda dengan Google Drive. Memuat turun dari Google Drive akan menggantikan semua data semasa anda."
                : "Synchronize all your family files with Google Drive. Downloading from Google Drive will overwrite all of your current data."
              }
            </Text>

            {/* Send to Google Drive */}
            <Pressable
              onPress={handleSendToDrive}
              disabled={sending}
              style={({ pressed }) => [{ opacity: sending ? 0.5 : pressed ? 0.8 : 1 }]}
            >
              <View className="rounded-xl py-3.5 items-center mb-2" style={{ backgroundColor: "#DB4437" }}>
                {sending ? (
                  <View className="flex-row items-center gap-2">
                    <ActivityIndicator size="small" color="#fff" />
                    <Text className="text-sm font-bold text-white tracking-wide">
                      {lang === "bm" ? "MENGHANTAR..." : "SENDING..."}
                    </Text>
                  </View>
                ) : (
                  <Text className="text-sm font-bold text-white tracking-wide">
                    {lang === "bm" ? "HANTAR KE GOOGLE DRIVE" : "SEND TO GOOGLE DRIVE"}
                  </Text>
                )}
              </View>
            </Pressable>

            {/* Download from Google Drive */}
            <Pressable
              onPress={handleDownloadFromDrive}
              disabled={downloading}
              style={({ pressed }) => [{ opacity: downloading ? 0.5 : pressed ? 0.8 : 1 }]}
            >
              <View className="rounded-xl py-3.5 items-center mb-4" style={{ backgroundColor: "#DB4437" }}>
                {downloading ? (
                  <View className="flex-row items-center gap-2">
                    <ActivityIndicator size="small" color="#fff" />
                    <Text className="text-sm font-bold text-white tracking-wide">
                      {lang === "bm" ? "MEMUAT TURUN..." : "DOWNLOADING..."}
                    </Text>
                  </View>
                ) : (
                  <Text className="text-sm font-bold text-white tracking-wide">
                    {lang === "bm" ? "MUAT TURUN DARI GOOGLE DRIVE" : "DOWNLOAD FROM GOOGLE DRIVE"}
                  </Text>
                )}
              </View>
            </Pressable>

            {/* Sync Settings */}
            <View className="mb-6">
              <View className="flex-row items-center justify-between py-3">
                <Text className="text-sm text-foreground flex-1">
                  {lang === "bm" ? "Auto segerak apabila menambah/mengedit data." : "Auto-backup while adding/editing data."}
                </Text>
                <Switch
                  value={autoBackup}
                  onValueChange={toggleAutoBackup}
                  trackColor={{ false: colors.border, true: colors.primary + "60" }}
                  thumbColor={autoBackup ? colors.primary : colors.muted}
                />
              </View>
              <View className="flex-row items-center justify-between py-3">
                <Text className="text-sm text-foreground flex-1">
                  {lang === "bm" ? "Segerak hanya melalui WiFi." : "Auto sync only on WiFi."}
                </Text>
                <Switch
                  value={wifiOnly}
                  onValueChange={toggleWifiOnly}
                  trackColor={{ false: colors.border, true: colors.primary + "60" }}
                  thumbColor={wifiOnly ? colors.primary : colors.muted}
                />
              </View>
            </View>

            <View className="h-px bg-border mb-6" />
          </>
        )}

        {/* ===== IMPORT/EXPORT SELECTIVELY ===== */}
        <Text className="text-xs font-bold text-muted uppercase tracking-widest mb-1">
          {lang === "bm" ? "IMPORT/EKSPORT TERPILIH" : "IMPORT/EXPORT SELECTIVELY"}
        </Text>
        <Text className="text-xs text-muted mb-4">
          {lang === "bm"
            ? "Eksport mencipta fail CSV baru pada peranti anda. Import memulihkan dari fail CSV yang telah dieksport sebelumnya."
            : "Export will create a new CSV file on your device. Import will restore from a previously exported CSV file."
          }
        </Text>

        {/* Import Button */}
        <Pressable
          onPress={handleImportLocal}
          disabled={importing}
          style={({ pressed }) => [{ opacity: importing ? 0.5 : pressed ? 0.8 : 1 }]}
        >
          <View className="rounded-xl py-3.5 items-center mb-2" style={{ backgroundColor: "#DB4437" }}>
            {importing ? (
              <View className="flex-row items-center gap-2">
                <ActivityIndicator size="small" color="#fff" />
                <Text className="text-sm font-bold text-white tracking-wide">
                  {lang === "bm" ? "MENGIMPORT..." : "IMPORTING..."}
                </Text>
              </View>
            ) : (
              <Text className="text-sm font-bold text-white tracking-wide">
                {lang === "bm" ? "IMPORT" : "IMPORT"}
              </Text>
            )}
          </View>
        </Pressable>

        {/* Export Button */}
        <Pressable
          onPress={handleExportLocal}
          disabled={exporting}
          style={({ pressed }) => [{ opacity: exporting ? 0.5 : pressed ? 0.8 : 1 }]}
        >
          <View className="rounded-xl py-3.5 items-center mb-6" style={{ backgroundColor: "#DB4437" }}>
            {exporting ? (
              <View className="flex-row items-center gap-2">
                <ActivityIndicator size="small" color="#fff" />
                <Text className="text-sm font-bold text-white tracking-wide">
                  {lang === "bm" ? "MENGEKSPORT..." : "EXPORTING..."}
                </Text>
              </View>
            ) : (
              <Text className="text-sm font-bold text-white tracking-wide">
                {lang === "bm" ? "EKSPORT" : "EXPORT"}
              </Text>
            )}
          </View>
        </Pressable>

        {/* ===== INFO SECTION ===== */}
        <View className="h-px bg-border mb-6" />

        {/* Warning */}
        <View className="rounded-2xl p-4 border mb-4" style={{ backgroundColor: colors.warning + "08", borderColor: colors.warning + "30" }}>
          <View className="flex-row items-start gap-3">
            <IconSymbol name="exclamationmark.triangle.fill" size={18} color={colors.warning} />
            <View className="flex-1">
              <Text className="text-sm font-medium text-foreground mb-1">
                {lang === "bm" ? "Penting" : "Important"}
              </Text>
              <Text className="text-xs text-muted leading-relaxed">
                {lang === "bm"
                  ? "Memulihkan atau mengimport data akan menggantikan semua data keluarga semasa. Sentiasa buat sandaran sebelum mengimport atau memuat turun dari Google Drive."
                  : "Restoring or importing data will replace all current family data. Always create a backup before importing or downloading from Google Drive."
                }
              </Text>
            </View>
          </View>
        </View>

        {/* Compatibility */}
        <View className="rounded-2xl p-4 border mb-4" style={{ backgroundColor: colors.primary + "08", borderColor: colors.primary + "30" }}>
          <View className="flex-row items-start gap-3">
            <IconSymbol name="info.circle.fill" size={18} color={colors.primary} />
            <View className="flex-1">
              <Text className="text-sm font-medium text-foreground mb-1">
                {lang === "bm" ? "Keserasian" : "Compatibility"}
              </Text>
              <Text className="text-xs text-muted leading-relaxed">
                {lang === "bm"
                  ? "Fail CSV boleh dibuka dengan Excel, Google Sheets, atau mana-mana aplikasi hamparan. Sandaran JSON lama masih boleh diimport."
                  : "CSV files can be opened with Excel, Google Sheets, or any spreadsheet app. Legacy JSON backups can still be imported."
                }
              </Text>
            </View>
          </View>
        </View>

        {/* Data Summary */}
        <View className="bg-surface rounded-2xl border border-border p-4">
          <Text className="text-xs font-bold text-muted uppercase tracking-widest mb-3">
            {lang === "bm" ? "RINGKASAN DATA" : "DATA SUMMARY"}
          </Text>
          <View className="gap-2">
            <SummaryRow label={lang === "bm" ? "Ahli Keluarga" : "Family Members"} value={String(data.persons.length)} color={colors} />
            <SummaryRow label={lang === "bm" ? "Perkahwinan" : "Marriages"} value={String(data.marriages.length)} color={colors} />
            <SummaryRow label={lang === "bm" ? "Hubungan Ibu Bapa-Anak" : "Parent-Child Links"} value={String(data.parentChildren.length)} color={colors} />
            {lastBackup && (
              <SummaryRow label={lang === "bm" ? "Sandaran Terakhir" : "Last Backup"} value={lastBackup} color={colors} />
            )}
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

function SummaryRow({ label, value, color }: { label: string; value: string; color: any }) {
  return (
    <View className="flex-row items-center justify-between py-1.5">
      <Text className="text-xs text-muted">{label}</Text>
      <Text className="text-xs font-semibold text-foreground">{value}</Text>
    </View>
  );
}
