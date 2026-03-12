import { Text, View, Pressable, ScrollView, Alert, TextInput } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useFamily } from "@/lib/family-store";
import { useState } from "react";

function SettingsRow({ icon, title, subtitle, onPress, color, danger }: {
  icon: any;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  color?: string;
  danger?: boolean;
}) {
  const colors = useColors();
  const iconColor = danger ? colors.error : (color || colors.foreground);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
      <View className="flex-row items-center py-3.5 gap-3">
        <View className="w-8 h-8 rounded-lg items-center justify-center" style={{ backgroundColor: iconColor + "15" }}>
          <IconSymbol name={icon} size={18} color={iconColor} />
        </View>
        <View className="flex-1">
          <Text className={`text-sm font-medium ${danger ? "text-error" : "text-foreground"}`}>{title}</Text>
          {subtitle && <Text className="text-xs text-muted mt-0.5">{subtitle}</Text>}
        </View>
        {onPress && <IconSymbol name="chevron.right" size={16} color={colors.muted} />}
      </View>
    </Pressable>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const colors = useColors();
  const { data, setFamilyName, resetData } = useFamily();
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(data.familyName);

  const handleSaveName = () => {
    if (nameInput.trim()) {
      setFamilyName(nameInput.trim());
    }
    setEditingName(false);
  };

  const handleReset = () => {
    Alert.alert(
      "Reset All Data",
      "This will permanently delete all family members and relationships. This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Reset", style: "destructive", onPress: () => resetData() },
      ]
    );
  };

  return (
    <ScreenContainer className="px-5 pt-2">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        <Text className="text-2xl font-bold text-foreground mb-6">Settings</Text>

        {/* Family Name */}
        <Text className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Family</Text>
        <View className="bg-surface rounded-2xl px-4 border border-border mb-6">
          {editingName ? (
            <View className="flex-row items-center py-3 gap-2">
              <TextInput
                value={nameInput}
                onChangeText={setNameInput}
                className="flex-1 text-sm text-foreground"
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleSaveName}
                style={{ color: colors.foreground }}
                placeholderTextColor={colors.muted}
              />
              <Pressable onPress={handleSaveName} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
                <View className="bg-primary rounded-lg px-3 py-1.5">
                  <Text className="text-white text-xs font-medium">Save</Text>
                </View>
              </Pressable>
            </View>
          ) : (
            <SettingsRow
              icon="pencil"
              title={data.familyName}
              subtitle="Tap to change family name"
              onPress={() => { setNameInput(data.familyName); setEditingName(true); }}
            />
          )}
        </View>

        {/* Collaboration */}
        <Text className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Collaboration</Text>
        <View className="bg-surface rounded-2xl px-4 border border-border mb-6">
          <SettingsRow
            icon="person.2.fill"
            title="Shared Members"
            subtitle={`${data.collaborators.length} collaborator${data.collaborators.length !== 1 ? "s" : ""}`}
            onPress={() => router.push("/invite-family" as any)}
            color={colors.primary}
          />
          <View className="h-px bg-border" />
          <SettingsRow
            icon="envelope.fill"
            title="Invite Family"
            subtitle="Share your tree via email"
            onPress={() => router.push("/invite-family" as any)}
            color="#5856D6"
          />
        </View>

        {/* Data */}
        <Text className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Data</Text>
        <View className="bg-surface rounded-2xl px-4 border border-border mb-6">
          <SettingsRow
            icon="arrow.down.doc.fill"
            title="Export Data"
            subtitle="Save family tree as JSON backup"
            onPress={() => Alert.alert("Export", "Family data exported successfully (simulated).")}
            color="#34C759"
          />
          <View className="h-px bg-border" />
          <SettingsRow
            icon="trash.fill"
            title="Reset All Data"
            subtitle="Delete all members and start over"
            onPress={handleReset}
            danger
          />
        </View>

        {/* About */}
        <Text className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">About</Text>
        <View className="bg-surface rounded-2xl px-4 border border-border mb-6">
          <SettingsRow icon="info.circle.fill" title="Waris Genealogy" subtitle="Version 1.0.0" />
          <View className="h-px bg-border" />
          <SettingsRow icon="heart.fill" title="Made for Malaysia" subtitle="Muslim & Non-Muslim families" color={colors.error} />
        </View>

        <Text className="text-xs text-muted text-center mt-4">
          Waris Genealogy App v1.0{"\n"}Built with love for Malaysian families
        </Text>
      </ScrollView>
    </ScreenContainer>
  );
}
