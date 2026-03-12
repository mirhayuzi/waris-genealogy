import { Text, View, Pressable, ScrollView, TextInput, Alert } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useFamily } from "@/lib/family-store";
import { UserRole } from "@/lib/types";
import { useState } from "react";

const ROLES: { value: UserRole; label: string; description: string }[] = [
  { value: "editor", label: "Editor", description: "Can add and edit family members" },
  { value: "viewer", label: "Viewer", description: "Can only view the family tree" },
];

export default function InviteFamilyScreen() {
  const router = useRouter();
  const colors = useColors();
  const { data, addCollaborator, removeCollaborator } = useFamily();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<UserRole>("editor");

  const handleInvite = () => {
    if (!email.trim()) {
      Alert.alert("Required", "Please enter an email address.");
      return;
    }
    if (!email.includes("@")) {
      Alert.alert("Invalid", "Please enter a valid email address.");
      return;
    }
    const exists = data.collaborators.some((c) => c.email.toLowerCase() === email.trim().toLowerCase());
    if (exists) {
      Alert.alert("Already Invited", "This email has already been invited.");
      return;
    }

    addCollaborator({ email: email.trim(), name: name.trim() || undefined, role });
    Alert.alert(
      "Invitation Sent",
      `An invitation has been sent to ${email.trim()} as ${role}.`,
      [{ text: "OK", onPress: () => { setEmail(""); setName(""); } }]
    );
  };

  const handleRemove = (id: string, emailAddr: string) => {
    Alert.alert("Remove Collaborator", `Remove ${emailAddr} from your family tree?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => removeCollaborator(id) },
    ]);
  };

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]} className="px-5 pt-2">
      {/* Header */}
      <View className="flex-row items-center justify-between mb-4">
        <Pressable onPress={() => router.back()} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
          <View className="flex-row items-center gap-1">
            <IconSymbol name="xmark" size={20} color={colors.foreground} />
            <Text className="text-sm text-foreground">Close</Text>
          </View>
        </Pressable>
        <Text className="text-lg font-semibold text-foreground">Invite Family</Text>
        <View className="w-12" />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Info */}
        <View className="bg-primary/8 rounded-2xl p-4 border border-primary/20 mb-6">
          <Text className="text-sm font-medium text-foreground mb-1">Collaborate with Family</Text>
          <Text className="text-xs text-muted leading-relaxed">
            Invite your siblings, cousins, or relatives by email. They can help build the family tree 
            together. You can assign roles to control what they can do.
          </Text>
        </View>

        {/* Invite Form */}
        <Text className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">New Invitation</Text>
        <View className="bg-surface rounded-2xl p-4 border border-border mb-6">
          <Text className="text-xs text-muted mb-1">Name (Optional)</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. Abang Ali"
            placeholderTextColor={colors.muted}
            className="border border-border rounded-xl px-4 py-2.5 text-sm mb-3"
            style={{ color: colors.foreground }}
          />

          <Text className="text-xs text-muted mb-1">Email Address *</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="e.g. ali@gmail.com"
            placeholderTextColor={colors.muted}
            keyboardType="email-address"
            autoCapitalize="none"
            className="border border-border rounded-xl px-4 py-2.5 text-sm mb-3"
            style={{ color: colors.foreground }}
          />

          <Text className="text-xs text-muted mb-2">Role</Text>
          <View className="flex-row gap-2 mb-4">
            {ROLES.map((r) => (
              <Pressable key={r.value} onPress={() => setRole(r.value)} style={({ pressed }) => [{ flex: 1, opacity: pressed ? 0.8 : 1 }]}>
                <View
                  className="py-3 rounded-xl border items-center"
                  style={{
                    backgroundColor: role === r.value ? colors.primary : "transparent",
                    borderColor: role === r.value ? colors.primary : colors.border,
                  }}
                >
                  <Text className="text-sm font-medium" style={{ color: role === r.value ? "#fff" : colors.foreground }}>
                    {r.label}
                  </Text>
                  <Text className="text-[10px] mt-0.5" style={{ color: role === r.value ? "rgba(255,255,255,0.7)" : colors.muted }}>
                    {r.description}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>

          <Pressable onPress={handleInvite} style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}>
            <View className="bg-primary rounded-xl py-3 items-center flex-row justify-center gap-2">
              <IconSymbol name="paperplane.fill" size={16} color="#fff" />
              <Text className="text-white font-semibold text-sm">Send Invitation</Text>
            </View>
          </Pressable>
        </View>

        {/* Collaborators List */}
        <Text className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">
          Collaborators ({data.collaborators.length})
        </Text>
        {data.collaborators.length === 0 ? (
          <View className="bg-surface rounded-2xl p-6 border border-border items-center">
            <IconSymbol name="person.2.fill" size={32} color={colors.muted} />
            <Text className="text-sm text-muted mt-2 text-center">
              No collaborators yet. Invite your family members to start sharing your tree.
            </Text>
          </View>
        ) : (
          <View className="gap-2">
            {data.collaborators.map((collab) => (
              <View key={collab.id} className="flex-row items-center bg-surface rounded-xl p-3 border border-border gap-3">
                <View className="w-10 h-10 rounded-full items-center justify-center" style={{ backgroundColor: colors.primary + "15" }}>
                  <Text className="text-sm font-bold" style={{ color: colors.primary }}>
                    {(collab.name || collab.email).charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-medium text-foreground">{collab.name || collab.email}</Text>
                  <Text className="text-xs text-muted">{collab.email}</Text>
                  <View className="flex-row items-center gap-2 mt-0.5">
                    <View
                      className="px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: collab.role === "editor" ? colors.primary + "18" : colors.muted + "18" }}
                    >
                      <Text className="text-[10px] font-medium" style={{ color: collab.role === "editor" ? colors.primary : colors.muted }}>
                        {collab.role.toUpperCase()}
                      </Text>
                    </View>
                    <View
                      className="px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: collab.status === "accepted" ? colors.success + "18" : colors.warning + "18" }}
                    >
                      <Text className="text-[10px] font-medium" style={{ color: collab.status === "accepted" ? colors.success : colors.warning }}>
                        {collab.status.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                </View>
                <Pressable
                  onPress={() => handleRemove(collab.id, collab.email)}
                  style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
                >
                  <View className="w-8 h-8 rounded-full bg-error/10 items-center justify-center">
                    <IconSymbol name="xmark" size={14} color={colors.error} />
                  </View>
                </Pressable>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
