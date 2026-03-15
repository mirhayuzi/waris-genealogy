import { Text, View, Pressable, ScrollView, Alert, Switch, Platform } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useFamily } from "@/lib/family-store";
import { useI18n } from "@/lib/i18n";
import { useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { FamilyData } from "@/lib/types";

// Lazy-load native modules to prevent crashes if not available
let FileSystem: any = null;
let Sharing: any = null;
let MailComposer: any = null;
let DocumentPicker: any = null;

try { FileSystem = require("expo-file-system/legacy"); } catch {}
try { Sharing = require("expo-sharing"); } catch {}
try { MailComposer = require("expo-mail-composer"); } catch {}
try { DocumentPicker = require("expo-document-picker"); } catch {}

const BACKUP_DATE_KEY = "@waris_last_backup";
const BACKUP_AUTO_KEY = "@waris_auto_backup";
const BACKUP_WIFI_KEY = "@waris_wifi_only";

export default function BackupRestoreScreen() {
  const router = useRouter();
  const colors = useColors();
  const { data } = useFamily();
  const { t } = useI18n();
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [lastBackup, setLastBackup] = useState<string | null>(null);
  const [autoBackup, setAutoBackup] = useState(false);
  const [wifiOnly, setWifiOnly] = useState(true);
  const [backupSuccess, setBackupSuccess] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(BACKUP_DATE_KEY).then((d) => { if (d) setLastBackup(d); });
    AsyncStorage.getItem(BACKUP_AUTO_KEY).then((d) => { if (d === "true") setAutoBackup(true); });
    AsyncStorage.getItem(BACKUP_WIFI_KEY).then((d) => { if (d !== "false") setWifiOnly(true); });
  }, []);

  const toggleAutoBackup = (val: boolean) => {
    setAutoBackup(val);
    AsyncStorage.setItem(BACKUP_AUTO_KEY, String(val));
  };

  const toggleWifiOnly = (val: boolean) => {
    setWifiOnly(val);
    AsyncStorage.setItem(BACKUP_WIFI_KEY, String(val));
  };

  const createBackupJSON = (): string => {
    return JSON.stringify(data, null, 2);
  };

  // Write backup file to device storage and return the file path
  const writeBackupFile = async (): Promise<string | null> => {
    const json = createBackupJSON();
    const fileName = `waris-backup-${new Date().toISOString().split("T")[0]}.json`;

    if (Platform.OS === "web") {
      // On web, trigger browser download
      try {
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
        const now = new Date().toLocaleString("en-MY");
        await AsyncStorage.setItem(BACKUP_DATE_KEY, now);
        setLastBackup(now);
      } catch (e: any) {
        Alert.alert("Error", `Web download failed: ${e?.message || "Unknown"}`);
      }
      return null;
    }

    // On native, try FileSystem
    if (!FileSystem) {
      Alert.alert("Error", "File system is not available. Please try sharing via email instead.");
      return null;
    }

    try {
      // Try documentDirectory first, then cacheDirectory as fallback
      const dir = FileSystem.documentDirectory || FileSystem.cacheDirectory;
      if (!dir) {
        Alert.alert("Error", "No writable directory available on this device.");
        return null;
      }

      const filePath = `${dir}${fileName}`;
      await FileSystem.writeAsStringAsync(filePath, json, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      const now = new Date().toLocaleString("en-MY");
      await AsyncStorage.setItem(BACKUP_DATE_KEY, now);
      setLastBackup(now);
      return filePath;
    } catch (e: any) {
      console.error("writeBackupFile error:", e);
      Alert.alert("Error", `Failed to create backup file: ${e?.message || "Unknown error"}`);
      return null;
    }
  };

  // ---- SYNCHRONIZE: Send to Google Drive (via system share sheet) ----
  const handleSendToDrive = async () => {
    if (data.persons.length === 0) {
      Alert.alert("No Data", "Please add family members before syncing.");
      return;
    }
    setExporting(true);
    setBackupSuccess(false);
    try {
      const filePath = await writeBackupFile();
      if (!filePath && Platform.OS !== "web") {
        setExporting(false);
        return;
      }
      if (filePath && Sharing) {
        try {
          const canShare = await Sharing.isAvailableAsync();
          if (canShare) {
            await Sharing.shareAsync(filePath, {
              mimeType: "application/json",
              dialogTitle: "Save to Google Drive",
              UTI: "public.json",
            });
            setBackupSuccess(true);
          } else {
            Alert.alert("Saved", "Backup file saved locally. Sharing not available.");
          }
        } catch (shareErr: any) {
          // User cancelled share - not an error
          if (shareErr?.message?.includes("User did not share") || shareErr?.message?.includes("cancel")) {
            // Silently ignore cancellation
          } else {
            Alert.alert("Share Error", `${shareErr?.message || "Unknown share error"}`);
          }
        }
      } else if (Platform.OS === "web") {
        setBackupSuccess(true);
        Alert.alert("Success", "Backup file downloaded.");
      }
    } catch (e: any) {
      console.error("handleSendToDrive error:", e);
      Alert.alert("Error", `Failed: ${e?.message || "Unknown error"}`);
    } finally {
      setExporting(false);
    }
  };

  // ---- SYNCHRONIZE: Download from Google Drive (via document picker) ----
  const handleDownloadFromDrive = async () => {
    if (!DocumentPicker) {
      Alert.alert("Error", "Document picker is not available on this device.");
      return;
    }
    setImporting(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/json", "*/*"],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        setImporting(false);
        return;
      }

      const asset = result.assets[0];
      let content: string;

      if (Platform.OS === "web" && asset.file) {
        content = await asset.file.text();
      } else if (FileSystem) {
        content = await FileSystem.readAsStringAsync(asset.uri, {
          encoding: FileSystem.EncodingType.UTF8,
        });
      } else {
        Alert.alert("Error", "Cannot read file on this platform.");
        setImporting(false);
        return;
      }

      let parsed: FamilyData;
      try {
        parsed = JSON.parse(content) as FamilyData;
      } catch {
        Alert.alert("Invalid File", "The selected file is not valid JSON. Please select a Waris backup file.");
        setImporting(false);
        return;
      }

      if (!parsed.persons || !Array.isArray(parsed.persons)) {
        Alert.alert("Invalid File", "The file does not contain valid Waris family data.");
        setImporting(false);
        return;
      }

      Alert.alert(
        "Restore Data",
        `Found ${parsed.persons.length} members and ${parsed.marriages?.length || 0} marriages.\n\nThis will replace ALL current data. Continue?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Restore",
            style: "destructive",
            onPress: async () => {
              try {
                await AsyncStorage.setItem("@waris_family_data", JSON.stringify(parsed));
                Alert.alert("Restored", `Successfully restored ${parsed.persons.length} members.\n\nPlease restart the app to see changes.`);
              } catch (e) {
                Alert.alert("Error", "Failed to restore data.");
              }
            },
          },
        ]
      );
    } catch (e: any) {
      console.error("handleDownloadFromDrive error:", e);
      Alert.alert("Error", `Failed to read backup: ${e?.message || "Unknown error"}`);
    } finally {
      setImporting(false);
    }
  };

  // ---- SHARE: Email backup ----
  const handleShareViaEmail = async () => {
    if (data.persons.length === 0) {
      Alert.alert("No Data", "Please add family members before sharing.");
      return;
    }
    setExporting(true);
    try {
      const filePath = await writeBackupFile();
      if (!filePath && Platform.OS !== "web") {
        setExporting(false);
        return;
      }
      if (filePath && Platform.OS !== "web") {
        // Try MailComposer first
        if (MailComposer) {
          try {
            const isAvailable = await MailComposer.isAvailableAsync();
            if (isAvailable) {
              await MailComposer.composeAsync({
                subject: `Waris Genealogy Backup - ${data.familyName}`,
                body: `Attached is the family tree backup for "${data.familyName}" containing ${data.persons.length} members.\n\nGenerated by Waris Genealogy App.`,
                attachments: [filePath],
              });
              setExporting(false);
              return;
            }
          } catch (_) {
            // MailComposer failed, fall through to sharing
          }
        }
        // Fallback to Sharing
        if (Sharing) {
          try {
            const canShare = await Sharing.isAvailableAsync();
            if (canShare) {
              await Sharing.shareAsync(filePath, {
                mimeType: "application/json",
                dialogTitle: "Share Waris Backup via Email",
              });
            } else {
              Alert.alert("Not Available", "No email or sharing option available.");
            }
          } catch (shareErr: any) {
            if (!shareErr?.message?.includes("cancel") && !shareErr?.message?.includes("User did not share")) {
              Alert.alert("Error", shareErr?.message || "Share failed");
            }
          }
        } else {
          Alert.alert("Not Available", "Sharing is not available on this device.");
        }
      }
    } catch (e: any) {
      console.error("handleShareViaEmail error:", e);
      Alert.alert("Error", `Failed: ${e?.message || "Unknown error"}`);
    } finally {
      setExporting(false);
    }
  };

  // ---- SELECTIVE: Export JSON to local ----
  const handleExportLocal = async () => {
    if (data.persons.length === 0) {
      Alert.alert("No Data", "Please add family members before exporting.");
      return;
    }
    setExporting(true);
    try {
      const filePath = await writeBackupFile();
      if (filePath && Sharing) {
        try {
          const canShare = await Sharing.isAvailableAsync();
          if (canShare) {
            await Sharing.shareAsync(filePath, {
              mimeType: "application/json",
              dialogTitle: "Save Waris Backup",
            });
          } else {
            Alert.alert("Saved", "Backup file saved to app storage.");
          }
        } catch (shareErr: any) {
          if (!shareErr?.message?.includes("cancel") && !shareErr?.message?.includes("User did not share")) {
            Alert.alert("Error", shareErr?.message || "Share failed");
          }
        }
      } else if (Platform.OS === "web") {
        Alert.alert("Success", "Backup file downloaded.");
      } else if (!filePath) {
        // writeBackupFile already showed error
      }
    } catch (e: any) {
      Alert.alert("Error", `Failed to export: ${e?.message || "Unknown error"}`);
    } finally {
      setExporting(false);
    }
  };

  // ---- SELECTIVE: Import JSON from local ----
  const handleImportLocal = async () => {
    if (!DocumentPicker) {
      Alert.alert("Error", "Document picker is not available.");
      return;
    }
    setImporting(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/json", "*/*"],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        setImporting(false);
        return;
      }

      const asset = result.assets[0];
      let content: string;

      if (Platform.OS === "web" && asset.file) {
        content = await asset.file.text();
      } else if (FileSystem) {
        content = await FileSystem.readAsStringAsync(asset.uri, {
          encoding: FileSystem.EncodingType.UTF8,
        });
      } else {
        Alert.alert("Error", "Cannot read file on this platform.");
        setImporting(false);
        return;
      }

      let parsed: FamilyData;
      try {
        parsed = JSON.parse(content) as FamilyData;
      } catch {
        Alert.alert("Invalid File", "The file is not valid JSON.");
        setImporting(false);
        return;
      }

      if (!parsed.persons || !Array.isArray(parsed.persons)) {
        Alert.alert("Invalid File", "The file does not contain valid Waris data.");
        setImporting(false);
        return;
      }

      Alert.alert(
        "Import Data",
        `Found ${parsed.persons.length} members and ${parsed.marriages?.length || 0} marriages.\n\nThis will replace ALL current data. Continue?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Import",
            style: "destructive",
            onPress: async () => {
              try {
                await AsyncStorage.setItem("@waris_family_data", JSON.stringify(parsed));
                Alert.alert("Imported", `Successfully imported ${parsed.persons.length} members.\n\nPlease restart the app to see changes.`);
              } catch (e) {
                Alert.alert("Error", "Failed to import data.");
              }
            },
          },
        ]
      );
    } catch (e: any) {
      console.error("handleImportLocal error:", e);
      Alert.alert("Error", `Failed to import: ${e?.message || "Unknown error"}`);
    } finally {
      setImporting(false);
    }
  };

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
        <Text className="text-xl font-bold text-foreground flex-1">{t("backupTitle")}</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>

        {/* Status Card */}
        <View className="bg-surface rounded-2xl p-4 border border-border mb-6">
          <View className="flex-row items-center gap-3 mb-3">
            <View className="w-12 h-12 rounded-xl items-center justify-center" style={{ backgroundColor: colors.primary + "15" }}>
              <IconSymbol name="folder.fill" size={24} color={colors.primary} />
            </View>
            <View className="flex-1">
              <Text className="text-base font-semibold text-foreground">{data.familyName}</Text>
              <Text className="text-xs text-muted">
                {data.persons.length} {t("members")} · {data.marriages.length} {t("marriages").toLowerCase()}
              </Text>
            </View>
            {backupSuccess && (
              <View className="px-2 py-1 rounded-full" style={{ backgroundColor: colors.success + "20" }}>
                <Text className="text-[10px] font-bold" style={{ color: colors.success }}>SYNCED</Text>
              </View>
            )}
          </View>
          <View className="flex-row items-center gap-2">
            <IconSymbol name="clock.fill" size={14} color={colors.muted} />
            <Text className="text-xs text-muted">
              {t("lastBackup")}: {lastBackup || t("never")}
            </Text>
          </View>
        </View>

        {/* ===== SYNCHRONIZE SECTION (Fuelio-style) ===== */}
        <Text className="text-xs font-bold text-muted uppercase tracking-widest mb-1">SYNCHRONIZE</Text>
        <Text className="text-xs text-muted mb-4">
          Sync your family data via Google Drive. Tap "Send" to upload, or "Download" to pick a backup file from Drive or device.
        </Text>

        {/* Send to Google Drive */}
        <Pressable
          onPress={handleSendToDrive}
          disabled={exporting}
          style={({ pressed }) => [{ opacity: exporting ? 0.5 : pressed ? 0.8 : 1 }]}
        >
          <View className="rounded-xl py-3.5 items-center mb-2" style={{ backgroundColor: "#4285F4" }}>
            <Text className="text-sm font-bold text-white tracking-wide">
              {exporting ? "SENDING..." : "SEND TO GOOGLE DRIVE"}
            </Text>
          </View>
        </Pressable>

        {/* Download from Google Drive */}
        <Pressable
          onPress={handleDownloadFromDrive}
          disabled={importing}
          style={({ pressed }) => [{ opacity: importing ? 0.5 : pressed ? 0.8 : 1 }]}
        >
          <View className="rounded-xl py-3.5 items-center mb-4 border" style={{ borderColor: "#4285F4", backgroundColor: "#4285F4" + "10" }}>
            <Text className="text-sm font-bold tracking-wide" style={{ color: "#4285F4" }}>
              {importing ? "DOWNLOADING..." : "DOWNLOAD FROM GOOGLE DRIVE"}
            </Text>
          </View>
        </Pressable>

        {/* Sync Settings Toggles */}
        <View className="bg-surface rounded-2xl border border-border p-4 mb-6">
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-1 mr-3">
              <Text className="text-sm text-foreground">Auto sync on data changes</Text>
              <Text className="text-[10px] text-muted mt-0.5">Automatically backup when family data is modified</Text>
            </View>
            <Switch
              value={autoBackup}
              onValueChange={toggleAutoBackup}
              trackColor={{ false: colors.border, true: colors.primary + "60" }}
              thumbColor={autoBackup ? colors.primary : colors.muted}
            />
          </View>
          <View className="h-px bg-border mb-3" />
          <View className="flex-row items-center justify-between">
            <View className="flex-1 mr-3">
              <Text className="text-sm text-foreground">Sync only over WiFi</Text>
              <Text className="text-[10px] text-muted mt-0.5">Save mobile data by syncing only on WiFi</Text>
            </View>
            <Switch
              value={wifiOnly}
              onValueChange={toggleWifiOnly}
              trackColor={{ false: colors.border, true: colors.primary + "60" }}
              thumbColor={wifiOnly ? colors.primary : colors.muted}
            />
          </View>
        </View>

        {/* ===== SHARE VIA EMAIL SECTION ===== */}
        <Text className="text-xs font-bold text-muted uppercase tracking-widest mb-1">SHARE VIA EMAIL</Text>
        <Text className="text-xs text-muted mb-4">
          Email your family tree backup as an attachment to yourself or family members.
        </Text>

        <Pressable
          onPress={handleShareViaEmail}
          disabled={exporting}
          style={({ pressed }) => [{ opacity: exporting ? 0.5 : pressed ? 0.8 : 1 }]}
        >
          <View className="rounded-xl py-3.5 items-center mb-6" style={{ backgroundColor: "#EA4335" }}>
            <Text className="text-sm font-bold text-white tracking-wide">
              {exporting ? "PREPARING..." : "SEND VIA GMAIL / EMAIL"}
            </Text>
          </View>
        </Pressable>

        {/* ===== SELECTIVE IMPORT & EXPORT SECTION ===== */}
        <Text className="text-xs font-bold text-muted uppercase tracking-widest mb-1">SELECTIVE IMPORT & EXPORT</Text>
        <Text className="text-xs text-muted mb-4">
          Export creates a JSON file on your device. Import restores from a previously exported JSON file.
        </Text>

        <View className="flex-row gap-3 mb-6">
          {/* Export */}
          <Pressable
            onPress={handleExportLocal}
            disabled={exporting}
            style={({ pressed }) => [{ flex: 1, opacity: exporting ? 0.5 : pressed ? 0.8 : 1 }]}
          >
            <View className="rounded-xl py-3.5 items-center border" style={{ borderColor: colors.primary, backgroundColor: colors.primary + "10" }}>
              <IconSymbol name="arrow.up.doc.fill" size={18} color={colors.primary} />
              <Text className="text-xs font-bold mt-1" style={{ color: colors.primary }}>EXPORT</Text>
            </View>
          </Pressable>

          {/* Import */}
          <Pressable
            onPress={handleImportLocal}
            disabled={importing}
            style={({ pressed }) => [{ flex: 1, opacity: importing ? 0.5 : pressed ? 0.8 : 1 }]}
          >
            <View className="rounded-xl py-3.5 items-center border" style={{ borderColor: colors.warning, backgroundColor: colors.warning + "10" }}>
              <IconSymbol name="arrow.down.doc.fill" size={18} color={colors.warning} />
              <Text className="text-xs font-bold mt-1" style={{ color: colors.warning }}>IMPORT</Text>
            </View>
          </Pressable>
        </View>

        {/* Warning */}
        <View className="rounded-2xl p-4 border mb-4" style={{ backgroundColor: colors.warning + "08", borderColor: colors.warning + "30" }}>
          <View className="flex-row items-start gap-3">
            <IconSymbol name="exclamationmark.triangle.fill" size={18} color={colors.warning} />
            <View className="flex-1">
              <Text className="text-sm font-medium text-foreground mb-1">Important</Text>
              <Text className="text-xs text-muted leading-relaxed">
                Restoring or importing data will replace all current family data. Always create a backup before importing or downloading from Google Drive.
              </Text>
            </View>
          </View>
        </View>

        {/* Data Info */}
        <View className="bg-surface rounded-2xl border border-border p-4">
          <Text className="text-xs font-bold text-muted uppercase tracking-widest mb-3">DATA SUMMARY</Text>
          <View className="gap-2">
            <SummaryRow label="Family Members" value={String(data.persons.length)} color={colors} />
            <SummaryRow label="Marriages" value={String(data.marriages.length)} color={colors} />
            <SummaryRow label="Parent-Child Links" value={String(data.parentChildren.length)} color={colors} />
            <SummaryRow label="Collaborators" value={String(data.collaborators.length)} color={colors} />
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
