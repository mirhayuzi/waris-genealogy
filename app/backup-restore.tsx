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
import { exportFamilyDataAsCSV } from "@/lib/csv-export";
import { parseMembersCSV, parseMarriagesCSV, parseParentChildCSV, buildFamilyDataFromCSV } from "@/lib/csv-import";

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
  const { t, lang } = useI18n();
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

  // ---- Write CSV backup files and return the members.csv path for sharing ----
  const writeCSVBackup = async (): Promise<string | null> => {
    if (Platform.OS === "web") {
      // On web, trigger browser download of members CSV
      try {
        const { exportFamilyDataAsCSV: _unused, ...rest } = await import("@/lib/csv-export");
        // Build CSV content inline for web
        const membersCSV = buildMembersCSVString();
        const blob = new Blob([membersCSV], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `waris-backup-${new Date().toISOString().split("T")[0]}.csv`;
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

    // On native, use the CSV export system
    try {
      const result = await exportFamilyDataAsCSV(data.persons, data.marriages, data.parentChildren);
      if (result.success && result.folderPath) {
        const now = new Date().toLocaleString("en-MY");
        await AsyncStorage.setItem(BACKUP_DATE_KEY, now);
        setLastBackup(now);
        // Return the members.csv path for sharing
        return `${result.folderPath}/members.csv`;
      } else {
        Alert.alert(
          lang === "bm" ? "Ralat" : "Error",
          result.message
        );
        return null;
      }
    } catch (e: any) {
      console.error("writeCSVBackup error:", e);
      Alert.alert(
        lang === "bm" ? "Ralat" : "Error",
        `Failed to create CSV backup: ${e?.message || "Unknown error"}`
      );
      return null;
    }
  };

  // Build members CSV string for web fallback
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

  // ---- SYNCHRONIZE: Send to Google Drive (via system share sheet) ----
  const handleSendToDrive = async () => {
    if (data.persons.length === 0) {
      Alert.alert(
        lang === "bm" ? "Tiada Data" : "No Data",
        lang === "bm" ? "Sila tambah ahli keluarga sebelum menyegerakkan." : "Please add family members before syncing."
      );
      return;
    }
    setExporting(true);
    setBackupSuccess(false);
    try {
      const csvPath = await writeCSVBackup();
      if (!csvPath && Platform.OS !== "web") {
        setExporting(false);
        return;
      }
      if (csvPath && Sharing) {
        try {
          const canShare = await Sharing.isAvailableAsync();
          if (canShare) {
            await Sharing.shareAsync(csvPath, {
              mimeType: "text/csv",
              dialogTitle: lang === "bm" ? "Simpan ke Google Drive" : "Save to Google Drive",
              UTI: "public.comma-separated-values-text",
            });
            setBackupSuccess(true);
          } else {
            Alert.alert(
              lang === "bm" ? "Disimpan" : "Saved",
              lang === "bm" ? "Fail sandaran CSV disimpan secara tempatan." : "CSV backup file saved locally. Sharing not available."
            );
          }
        } catch (shareErr: any) {
          if (!shareErr?.message?.includes("User did not share") && !shareErr?.message?.includes("cancel")) {
            Alert.alert(lang === "bm" ? "Ralat Kongsi" : "Share Error", `${shareErr?.message || "Unknown share error"}`);
          }
        }
      } else if (Platform.OS === "web") {
        setBackupSuccess(true);
        Alert.alert(
          lang === "bm" ? "Berjaya" : "Success",
          lang === "bm" ? "Fail sandaran CSV dimuat turun." : "CSV backup file downloaded."
        );
      }
    } catch (e: any) {
      console.error("handleSendToDrive error:", e);
      Alert.alert(lang === "bm" ? "Ralat" : "Error", `Failed: ${e?.message || "Unknown error"}`);
    } finally {
      setExporting(false);
    }
  };

  // ---- SYNCHRONIZE: Download/Import CSV from Google Drive ----
  const handleDownloadFromDrive = async () => {
    if (!DocumentPicker) {
      Alert.alert(lang === "bm" ? "Ralat" : "Error", lang === "bm" ? "Pemilih dokumen tidak tersedia." : "Document picker is not available on this device.");
      return;
    }
    setImporting(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["text/csv", "text/comma-separated-values", "*/*"],
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
        Alert.alert(lang === "bm" ? "Ralat" : "Error", lang === "bm" ? "Tidak dapat membaca fail." : "Cannot read file on this platform.");
        setImporting(false);
        return;
      }

      // Try to detect if it's JSON (legacy backup) or CSV
      const trimmed = content.trim();
      if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
        // Legacy JSON backup
        try {
          const parsed = JSON.parse(content) as FamilyData;
          if (!parsed.persons || !Array.isArray(parsed.persons)) {
            Alert.alert(
              lang === "bm" ? "Fail Tidak Sah" : "Invalid File",
              lang === "bm" ? "Fail tidak mengandungi data keluarga Waris yang sah." : "The file does not contain valid Waris family data."
            );
            setImporting(false);
            return;
          }
          confirmRestore(parsed);
        } catch {
          Alert.alert(
            lang === "bm" ? "Fail Tidak Sah" : "Invalid File",
            lang === "bm" ? "Fail JSON tidak sah." : "The file is not valid JSON."
          );
        }
        setImporting(false);
        return;
      }

      // Parse as CSV
      const persons = parseMembersCSV(content);
      if (persons.length === 0) {
        Alert.alert(
          lang === "bm" ? "Fail Tidak Sah" : "Invalid File",
          lang === "bm" ? "Tiada ahli keluarga ditemui dalam fail CSV. Pastikan fail mengandungi lajur 'ID' dan 'First Name'." : "No family members found in the CSV file. Make sure the file has 'ID' and 'First Name' columns."
        );
        setImporting(false);
        return;
      }

      // Build FamilyData from CSV (members only - marriages/parent-child will need separate files)
      const familyData = buildFamilyDataFromCSV(persons, [], [], data.familyName, undefined);
      confirmRestore(familyData);
    } catch (e: any) {
      console.error("handleDownloadFromDrive error:", e);
      Alert.alert(lang === "bm" ? "Ralat" : "Error", `Failed to read backup: ${e?.message || "Unknown error"}`);
    } finally {
      setImporting(false);
    }
  };

  // ---- Confirm and restore data ----
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
                  ? `Berjaya memulihkan ${parsed.persons.length} ahli.\n\nSila mulakan semula aplikasi untuk melihat perubahan.`
                  : `Successfully restored ${parsed.persons.length} members.\n\nPlease restart the app to see changes.`
              );
            } catch (e) {
              Alert.alert(lang === "bm" ? "Ralat" : "Error", lang === "bm" ? "Gagal memulihkan data." : "Failed to restore data.");
            }
          },
        },
      ]
    );
  };

  // ---- SHARE: Email CSV backup ----
  const handleShareViaEmail = async () => {
    if (data.persons.length === 0) {
      Alert.alert(
        lang === "bm" ? "Tiada Data" : "No Data",
        lang === "bm" ? "Sila tambah ahli keluarga sebelum berkongsi." : "Please add family members before sharing."
      );
      return;
    }
    setExporting(true);
    try {
      const csvPath = await writeCSVBackup();
      if (!csvPath && Platform.OS !== "web") {
        setExporting(false);
        return;
      }
      if (csvPath && Platform.OS !== "web") {
        // Try MailComposer first
        if (MailComposer) {
          try {
            const isAvailable = await MailComposer.isAvailableAsync();
            if (isAvailable) {
              await MailComposer.composeAsync({
                subject: `Waris Genealogy Backup - ${data.familyName}`,
                body: lang === "bm"
                  ? `Dilampirkan adalah sandaran salasilah keluarga untuk "${data.familyName}" mengandungi ${data.persons.length} ahli.\n\nDijana oleh Waris Genealogy App.`
                  : `Attached is the family tree backup for "${data.familyName}" containing ${data.persons.length} members.\n\nGenerated by Waris Genealogy App.`,
                attachments: [csvPath],
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
              await Sharing.shareAsync(csvPath, {
                mimeType: "text/csv",
                dialogTitle: lang === "bm" ? "Kongsi Sandaran Waris melalui Emel" : "Share Waris Backup via Email",
              });
            } else {
              Alert.alert(
                lang === "bm" ? "Tidak Tersedia" : "Not Available",
                lang === "bm" ? "Tiada pilihan emel atau perkongsian tersedia." : "No email or sharing option available."
              );
            }
          } catch (shareErr: any) {
            if (!shareErr?.message?.includes("cancel") && !shareErr?.message?.includes("User did not share")) {
              Alert.alert(lang === "bm" ? "Ralat" : "Error", shareErr?.message || "Share failed");
            }
          }
        } else {
          Alert.alert(
            lang === "bm" ? "Tidak Tersedia" : "Not Available",
            lang === "bm" ? "Perkongsian tidak tersedia pada peranti ini." : "Sharing is not available on this device."
          );
        }
      }
    } catch (e: any) {
      console.error("handleShareViaEmail error:", e);
      Alert.alert(lang === "bm" ? "Ralat" : "Error", `Failed: ${e?.message || "Unknown error"}`);
    } finally {
      setExporting(false);
    }
  };

  // ---- SELECTIVE: Export CSV to local ----
  const handleExportLocal = async () => {
    if (data.persons.length === 0) {
      Alert.alert(
        lang === "bm" ? "Tiada Data" : "No Data",
        lang === "bm" ? "Sila tambah ahli keluarga sebelum mengeksport." : "Please add family members before exporting."
      );
      return;
    }
    setExporting(true);
    try {
      const csvPath = await writeCSVBackup();
      if (csvPath && Sharing) {
        try {
          const canShare = await Sharing.isAvailableAsync();
          if (canShare) {
            await Sharing.shareAsync(csvPath, {
              mimeType: "text/csv",
              dialogTitle: lang === "bm" ? "Simpan Sandaran Waris" : "Save Waris Backup",
            });
          } else {
            Alert.alert(
              lang === "bm" ? "Disimpan" : "Saved",
              lang === "bm" ? "Fail sandaran CSV disimpan ke storan aplikasi." : "CSV backup file saved to app storage."
            );
          }
        } catch (shareErr: any) {
          if (!shareErr?.message?.includes("cancel") && !shareErr?.message?.includes("User did not share")) {
            Alert.alert(lang === "bm" ? "Ralat" : "Error", shareErr?.message || "Share failed");
          }
        }
      } else if (Platform.OS === "web") {
        Alert.alert(
          lang === "bm" ? "Berjaya" : "Success",
          lang === "bm" ? "Fail sandaran CSV dimuat turun." : "CSV backup file downloaded."
        );
      }
    } catch (e: any) {
      Alert.alert(lang === "bm" ? "Ralat" : "Error", `Failed to export: ${e?.message || "Unknown error"}`);
    } finally {
      setExporting(false);
    }
  };

  // ---- SELECTIVE: Import CSV from local ----
  const handleImportLocal = async () => {
    if (!DocumentPicker) {
      Alert.alert(lang === "bm" ? "Ralat" : "Error", lang === "bm" ? "Pemilih dokumen tidak tersedia." : "Document picker is not available.");
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

      // If multiple files selected, try to parse each
      let allPersons: any[] = [];
      let allMarriages: any[] = [];
      let allParentChildren: any[] = [];
      let foundJSON = false;

      for (const asset of result.assets) {
        let content: string;

        if (Platform.OS === "web" && asset.file) {
          content = await asset.file.text();
        } else if (FileSystem) {
          content = await FileSystem.readAsStringAsync(asset.uri, {
            encoding: FileSystem.EncodingType.UTF8,
          });
        } else {
          continue;
        }

        const trimmed = content.trim();

        // Check if it's JSON (legacy backup)
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

        // Parse as CSV - detect type by filename or headers
        const fileName = (asset.name || "").toLowerCase();
        const firstLine = content.split("\n")[0]?.toLowerCase() || "";

        if (fileName.includes("marriage") || firstLine.includes("marriage id") || firstLine.includes("husband id")) {
          allMarriages = parseMarriagesCSV(content);
        } else if (fileName.includes("parent") || firstLine.includes("relationship id") || firstLine.includes("parent id")) {
          allParentChildren = parseParentChildCSV(content);
        } else {
          // Default: members
          allPersons = parseMembersCSV(content);
        }
      }

      if (foundJSON) {
        setImporting(false);
        return;
      }

      if (allPersons.length === 0 && allMarriages.length === 0 && allParentChildren.length === 0) {
        Alert.alert(
          lang === "bm" ? "Fail Tidak Sah" : "Invalid File",
          lang === "bm" ? "Tiada data keluarga ditemui dalam fail yang dipilih." : "No family data found in the selected files."
        );
        setImporting(false);
        return;
      }

      const familyData = buildFamilyDataFromCSV(
        allPersons,
        allMarriages,
        allParentChildren,
        data.familyName,
        undefined,
      );

      confirmRestore(familyData);
    } catch (e: any) {
      console.error("handleImportLocal error:", e);
      Alert.alert(lang === "bm" ? "Ralat" : "Error", `Failed to import: ${e?.message || "Unknown error"}`);
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
          <View className="flex-row items-center gap-2 mt-1">
            <IconSymbol name="doc.text.fill" size={14} color={colors.muted} />
            <Text className="text-xs text-muted">
              {lang === "bm" ? "Format: CSV (Comma Separated Values)" : "Format: CSV (Comma Separated Values)"}
            </Text>
          </View>
        </View>

        {/* ===== SYNCHRONIZE SECTION (Fuelio-style) ===== */}
        <Text className="text-xs font-bold text-muted uppercase tracking-widest mb-1">
          {lang === "bm" ? "SEGERAKKAN" : "SYNCHRONIZE"}
        </Text>
        <Text className="text-xs text-muted mb-4">
          {lang === "bm"
            ? "Segerakkan data keluarga anda melalui Google Drive. Tekan \"Hantar\" untuk memuat naik, atau \"Muat Turun\" untuk memilih fail sandaran CSV."
            : "Sync your family data via Google Drive. Tap \"Send\" to upload CSV, or \"Download\" to pick a CSV backup file from Drive or device."
          }
        </Text>

        {/* Send to Google Drive */}
        <Pressable
          onPress={handleSendToDrive}
          disabled={exporting}
          style={({ pressed }) => [{ opacity: exporting ? 0.5 : pressed ? 0.8 : 1 }]}
        >
          <View className="rounded-xl py-3.5 items-center mb-2" style={{ backgroundColor: "#4285F4" }}>
            <Text className="text-sm font-bold text-white tracking-wide">
              {exporting
                ? (lang === "bm" ? "MENGHANTAR..." : "SENDING...")
                : (lang === "bm" ? "HANTAR KE GOOGLE DRIVE" : "SEND TO GOOGLE DRIVE")
              }
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
              {importing
                ? (lang === "bm" ? "MEMUAT TURUN..." : "DOWNLOADING...")
                : (lang === "bm" ? "MUAT TURUN DARI GOOGLE DRIVE" : "DOWNLOAD FROM GOOGLE DRIVE")
              }
            </Text>
          </View>
        </Pressable>

        {/* Sync Settings Toggles */}
        <View className="bg-surface rounded-2xl border border-border p-4 mb-6">
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-1 mr-3">
              <Text className="text-sm text-foreground">
                {lang === "bm" ? "Auto segerak pada perubahan data" : "Auto sync on data changes"}
              </Text>
              <Text className="text-[10px] text-muted mt-0.5">
                {lang === "bm" ? "Sandaran automatik apabila data keluarga diubah" : "Automatically backup when family data is modified"}
              </Text>
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
              <Text className="text-sm text-foreground">
                {lang === "bm" ? "Segerak hanya melalui WiFi" : "Sync only over WiFi"}
              </Text>
              <Text className="text-[10px] text-muted mt-0.5">
                {lang === "bm" ? "Jimat data mudah alih dengan menyegerak hanya pada WiFi" : "Save mobile data by syncing only on WiFi"}
              </Text>
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
        <Text className="text-xs font-bold text-muted uppercase tracking-widest mb-1">
          {lang === "bm" ? "KONGSI MELALUI EMEL" : "SHARE VIA EMAIL"}
        </Text>
        <Text className="text-xs text-muted mb-4">
          {lang === "bm"
            ? "Hantar fail sandaran CSV salasilah keluarga anda melalui emel kepada diri sendiri atau ahli keluarga."
            : "Email your family tree CSV backup as an attachment to yourself or family members."
          }
        </Text>

        <Pressable
          onPress={handleShareViaEmail}
          disabled={exporting}
          style={({ pressed }) => [{ opacity: exporting ? 0.5 : pressed ? 0.8 : 1 }]}
        >
          <View className="rounded-xl py-3.5 items-center mb-6" style={{ backgroundColor: "#EA4335" }}>
            <Text className="text-sm font-bold text-white tracking-wide">
              {exporting
                ? (lang === "bm" ? "MENYEDIAKAN..." : "PREPARING...")
                : (lang === "bm" ? "HANTAR MELALUI GMAIL / EMEL" : "SEND VIA GMAIL / EMAIL")
              }
            </Text>
          </View>
        </Pressable>

        {/* ===== SELECTIVE IMPORT & EXPORT SECTION ===== */}
        <Text className="text-xs font-bold text-muted uppercase tracking-widest mb-1">
          {lang === "bm" ? "IMPORT & EKSPORT TERPILIH" : "SELECTIVE IMPORT & EXPORT"}
        </Text>
        <Text className="text-xs text-muted mb-4">
          {lang === "bm"
            ? "Eksport mencipta fail CSV pada peranti anda. Import memulihkan dari fail CSV yang telah dieksport sebelumnya."
            : "Export creates CSV files on your device. Import restores from a previously exported CSV file."
          }
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
              <Text className="text-xs font-bold mt-1" style={{ color: colors.primary }}>
                {lang === "bm" ? "EKSPORT" : "EXPORT"}
              </Text>
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
              <Text className="text-xs font-bold mt-1" style={{ color: colors.warning }}>
                {lang === "bm" ? "IMPORT" : "IMPORT"}
              </Text>
            </View>
          </Pressable>
        </View>

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

        {/* Compatibility Note */}
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

        {/* Data Info */}
        <View className="bg-surface rounded-2xl border border-border p-4">
          <Text className="text-xs font-bold text-muted uppercase tracking-widest mb-3">
            {lang === "bm" ? "RINGKASAN DATA" : "DATA SUMMARY"}
          </Text>
          <View className="gap-2">
            <SummaryRow label={lang === "bm" ? "Ahli Keluarga" : "Family Members"} value={String(data.persons.length)} color={colors} />
            <SummaryRow label={lang === "bm" ? "Perkahwinan" : "Marriages"} value={String(data.marriages.length)} color={colors} />
            <SummaryRow label={lang === "bm" ? "Hubungan Ibu Bapa-Anak" : "Parent-Child Links"} value={String(data.parentChildren.length)} color={colors} />
            <SummaryRow label={lang === "bm" ? "Kolaborator" : "Collaborators"} value={String(data.collaborators.length)} color={colors} />
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
