import { Text, View, Pressable, ScrollView, Alert } from "react-native";
import { Image } from "expo-image";
import { useRouter, useLocalSearchParams } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useFamily } from "@/lib/family-store";
import { getDisplayName } from "@/lib/types";

function InfoRow({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <View className="flex-row justify-between py-2.5 border-b border-border">
      <Text className="text-sm text-muted">{label}</Text>
      <Text className="text-sm font-medium text-foreground flex-shrink" numberOfLines={1}>{value}</Text>
    </View>
  );
}

function RelationCard({ label, persons, onPress, colors }: {
  label: string;
  persons: { id: string; name: string; isAlive: boolean }[];
  onPress: (id: string) => void;
  colors: ReturnType<typeof useColors>;
}) {
  if (persons.length === 0) return null;
  return (
    <View className="mb-4">
      <Text className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">{label}</Text>
      <View className="gap-2">
        {persons.map((p) => (
          <Pressable key={p.id} onPress={() => onPress(p.id)} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
            <View className="flex-row items-center bg-surface rounded-xl p-3 border border-border gap-3">
              <View
                className="w-9 h-9 rounded-full items-center justify-center"
                style={{ backgroundColor: (p.isAlive ? colors.primary : colors.muted) + "20" }}
              >
                <Text className="text-sm font-bold" style={{ color: p.isAlive ? colors.primary : colors.muted }}>
                  {p.name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <Text className="flex-1 text-sm font-medium text-foreground">{p.name}</Text>
              <IconSymbol name="chevron.right" size={14} color={colors.muted} />
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export default function MemberProfileScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const { getPersonById, getParents, getChildren, getSpouses, getSiblings, deletePerson, data, setRootPerson } = useFamily();

  const person = getPersonById(id || "");
  if (!person) {
    return (
      <ScreenContainer className="items-center justify-center">
        <Text className="text-foreground">Person not found</Text>
        <Pressable onPress={() => router.back()} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
          <Text className="text-primary mt-4">Go Back</Text>
        </Pressable>
      </ScreenContainer>
    );
  }

  const parents = getParents(person.id).map((p) => ({ id: p.id, name: getDisplayName(p), isAlive: p.isAlive }));
  const children = getChildren(person.id).map((p) => ({ id: p.id, name: getDisplayName(p), isAlive: p.isAlive }));
  const spouses = getSpouses(person.id).map((p) => ({ id: p.id, name: getDisplayName(p), isAlive: p.isAlive }));
  const siblings = getSiblings(person.id).map((p) => ({ id: p.id, name: getDisplayName(p), isAlive: p.isAlive }));

  const navigateToPerson = (personId: string) => {
    router.push({ pathname: "/member-profile" as any, params: { id: personId } });
  };

  const handleDelete = () => {
    Alert.alert("Delete Member", `Are you sure you want to remove ${getDisplayName(person)} from the family tree?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => { deletePerson(person.id); router.back(); } },
    ]);
  };

  const isRoot = data.rootPersonId === person.id;

  return (
    <ScreenContainer className="pt-2">
      {/* Header */}
      <View className="flex-row items-center justify-between px-5 mb-4">
        <Pressable onPress={() => router.back()} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
          <View className="flex-row items-center gap-1">
            <IconSymbol name="chevron.left" size={20} color={colors.primary} />
            <Text className="text-sm text-primary">Back</Text>
          </View>
        </Pressable>
        <View className="flex-row gap-2">
          <Pressable
            onPress={() => router.push({ pathname: "/edit-member" as any, params: { id: person.id } })}
            style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
          >
            <View className="w-9 h-9 rounded-full bg-surface border border-border items-center justify-center">
              <IconSymbol name="pencil" size={16} color={colors.foreground} />
            </View>
          </Pressable>
          <Pressable onPress={handleDelete} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
            <View className="w-9 h-9 rounded-full bg-error/10 items-center justify-center">
              <IconSymbol name="trash.fill" size={16} color={colors.error} />
            </View>
          </Pressable>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: 20 }}>
        {/* Profile Header */}
        <View className="items-center mb-6">
          {person.photo ? (
            <View style={{ width: 96, height: 96, borderRadius: 48, borderWidth: 3, borderColor: person.isAlive ? colors.primary : colors.muted, overflow: "hidden", marginBottom: 12 }}>
              <Image source={{ uri: person.photo }} style={{ width: 90, height: 90, borderRadius: 45 }} contentFit="cover" />
            </View>
          ) : (
            <View
              className="w-24 h-24 rounded-full items-center justify-center mb-3"
              style={{
                backgroundColor: (person.isAlive ? colors.primary : colors.muted) + "15",
                borderColor: person.isAlive ? colors.primary : colors.muted,
                borderWidth: 3,
              }}
            >
              <Text className="text-3xl font-bold" style={{ color: person.isAlive ? colors.primary : colors.muted }}>
                {person.firstName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <Text className="text-xl font-bold text-foreground text-center">{getDisplayName(person)}</Text>
          <View className="flex-row items-center gap-2 mt-1">
            <View
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: person.isAlive ? colors.success : colors.muted }}
            />
            <Text className="text-sm text-muted">{person.isAlive ? "Living" : "Deceased"}</Text>
            {isRoot && (
              <View className="bg-primary/15 rounded-full px-2 py-0.5">
                <Text className="text-[10px] font-semibold" style={{ color: colors.primary }}>ROOT</Text>
              </View>
            )}
          </View>
        </View>

        {/* Quick Actions */}
        <View className="flex-row gap-2 mb-6">
          <Pressable
            onPress={() => router.push({ pathname: "/add-member" as any, params: { parentId: person.id } })}
            style={({ pressed }) => [{ flex: 1, opacity: pressed ? 0.7 : 1 }]}
          >
            <View className="bg-primary/10 rounded-xl py-3 items-center">
              <Text className="text-xs font-medium" style={{ color: colors.primary }}>+ Child</Text>
            </View>
          </Pressable>
          <Pressable
            onPress={() => router.push({ pathname: "/add-member" as any, params: { spouseId: person.id } })}
            style={({ pressed }) => [{ flex: 1, opacity: pressed ? 0.7 : 1 }]}
          >
            <View className="bg-primary/10 rounded-xl py-3 items-center">
              <Text className="text-xs font-medium" style={{ color: colors.primary }}>+ Spouse</Text>
            </View>
          </Pressable>
          <Pressable
            onPress={() => router.push({ pathname: "/add-member" as any, params: { childOfId: person.id } })}
            style={({ pressed }) => [{ flex: 1, opacity: pressed ? 0.7 : 1 }]}
          >
            <View className="bg-primary/10 rounded-xl py-3 items-center">
              <Text className="text-xs font-medium" style={{ color: colors.primary }}>+ Parent</Text>
            </View>
          </Pressable>
          {!isRoot && (
            <Pressable
              onPress={() => { setRootPerson(person.id); Alert.alert("Root Updated", `${person.firstName} is now the root of the tree.`); }}
              style={({ pressed }) => [{ flex: 1, opacity: pressed ? 0.7 : 1 }]}
            >
              <View className="rounded-xl py-3 items-center" style={{ backgroundColor: colors.accent + "18" }}>
                <Text className="text-xs font-medium" style={{ color: colors.accent }}>Set Root</Text>
              </View>
            </Pressable>
          )}
        </View>

        {/* Personal Details */}
        <Text className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Personal Details</Text>
        <View className="bg-surface rounded-2xl px-4 border border-border mb-6">
          <InfoRow label="Prefix" value={person.prefix} />
          <InfoRow label="First Name" value={person.firstName} />
          <InfoRow label={person.gender === "male" ? "Bin" : "Binti"} value={person.binBinti} />
          <InfoRow label="Last Name" value={person.lastName} />
          <InfoRow label="Gender" value={person.gender === "male" ? "Male (Lelaki)" : "Female (Perempuan)"} />
          <InfoRow label="Date of Birth" value={person.birthDate} />
          <InfoRow label="Place of Birth" value={person.birthPlace} />
          {!person.isAlive && <InfoRow label="Date of Death" value={person.deathDate} />}
          <InfoRow label="Ethnicity" value={person.race} />
          <InfoRow label="Religion" value={person.religion} />
          {person.bio && <InfoRow label="Notes" value={person.bio} />}
        </View>

        {/* Relationships */}
        <RelationCard label="Parents (Ibu Bapa)" persons={parents} onPress={navigateToPerson} colors={colors} />
        <RelationCard label="Spouse(s) (Pasangan)" persons={spouses} onPress={navigateToPerson} colors={colors} />
        <RelationCard label="Children (Anak)" persons={children} onPress={navigateToPerson} colors={colors} />
        <RelationCard label="Siblings (Adik-Beradik)" persons={siblings} onPress={navigateToPerson} colors={colors} />
      </ScrollView>
    </ScreenContainer>
  );
}
