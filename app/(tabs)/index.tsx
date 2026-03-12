import { ScrollView, Text, View, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useFamily } from "@/lib/family-store";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { getDisplayName } from "@/lib/types";

export default function HomeScreen() {
  const router = useRouter();
  const colors = useColors();
  const { data } = useFamily();
  const totalMembers = data.persons.length;
  const livingMembers = data.persons.filter((p) => p.isAlive).length;
  const deceasedMembers = totalMembers - livingMembers;
  const totalMarriages = data.marriages.length;

  const recentMembers = [...data.persons]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  return (
    <ScreenContainer className="px-5 pt-2">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        {/* Header */}
        <View className="mb-6">
          <Text className="text-sm text-muted mb-1">Assalamualaikum</Text>
          <Text className="text-3xl font-bold text-foreground">{data.familyName}</Text>
          <Text className="text-sm text-muted mt-1">
            {totalMembers} {totalMembers === 1 ? "member" : "members"} recorded
          </Text>
        </View>

        {/* Stats Cards */}
        <View className="flex-row gap-3 mb-6">
          <View className="flex-1 bg-surface rounded-2xl p-4 border border-border">
            <Text className="text-2xl font-bold text-primary">{livingMembers}</Text>
            <Text className="text-xs text-muted mt-1">Living</Text>
          </View>
          <View className="flex-1 bg-surface rounded-2xl p-4 border border-border">
            <Text className="text-2xl font-bold text-foreground">{deceasedMembers}</Text>
            <Text className="text-xs text-muted mt-1">Deceased</Text>
          </View>
          <View className="flex-1 bg-surface rounded-2xl p-4 border border-border">
            <Text className="text-2xl font-bold" style={{ color: colors.accent }}>{totalMarriages}</Text>
            <Text className="text-xs text-muted mt-1">Marriages</Text>
          </View>
        </View>

        {/* Quick Actions */}
        <Text className="text-lg font-semibold text-foreground mb-3">Quick Actions</Text>
        <View className="gap-3 mb-6">
          <Pressable
            onPress={() => router.push("/add-member" as any)}
            style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
          >
            <View className="flex-row items-center bg-primary rounded-2xl p-4 gap-3">
              <View className="w-10 h-10 rounded-full bg-white/20 items-center justify-center">
                <IconSymbol name="person.badge.plus" size={22} color="#fff" />
              </View>
              <View className="flex-1">
                <Text className="text-base font-semibold text-white">Add Family Member</Text>
                <Text className="text-xs text-white/70">Record a new person in your tree</Text>
              </View>
              <IconSymbol name="chevron.right" size={20} color="rgba(255,255,255,0.5)" />
            </View>
          </Pressable>

          <View className="flex-row gap-3">
            <Pressable
              onPress={() => router.push("/(tabs)/tree")}
              style={({ pressed }) => [{ flex: 1, opacity: pressed ? 0.7 : 1 }]}
            >
              <View className="bg-surface rounded-2xl p-4 border border-border items-center gap-2">
                <IconSymbol name="tree" size={28} color={colors.primary} />
                <Text className="text-sm font-medium text-foreground">View Tree</Text>
              </View>
            </Pressable>
            <Pressable
              onPress={() => router.push("/invite-family" as any)}
              style={({ pressed }) => [{ flex: 1, opacity: pressed ? 0.7 : 1 }]}
            >
              <View className="bg-surface rounded-2xl p-4 border border-border items-center gap-2">
                <IconSymbol name="person.2.fill" size={28} color={colors.primary} />
                <Text className="text-sm font-medium text-foreground">Invite Family</Text>
              </View>
            </Pressable>
            <Pressable
              onPress={() => router.push("/faraid-calculator" as any)}
              style={({ pressed }) => [{ flex: 1, opacity: pressed ? 0.7 : 1 }]}
            >
              <View className="bg-surface rounded-2xl p-4 border border-border items-center gap-2">
                <IconSymbol name="chart.pie.fill" size={28} color={colors.primary} />
                <Text className="text-sm font-medium text-foreground">Faraid</Text>
              </View>
            </Pressable>
          </View>
        </View>

        {/* Recent Members */}
        {recentMembers.length > 0 && (
          <>
            <Text className="text-lg font-semibold text-foreground mb-3">Recently Added</Text>
            <View className="gap-2">
              {recentMembers.map((person) => (
                <Pressable
                  key={person.id}
                  onPress={() => router.push({ pathname: "/member-profile" as any, params: { id: person.id } })}
                  style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
                >
                  <View className="flex-row items-center bg-surface rounded-xl p-3 border border-border gap-3">
                    <View
                      className="w-10 h-10 rounded-full items-center justify-center"
                      style={{ backgroundColor: person.isAlive ? colors.primary + "20" : colors.muted + "20" }}
                    >
                      <Text className="text-base font-bold" style={{ color: person.isAlive ? colors.primary : colors.muted }}>
                        {person.firstName.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View className="flex-1">
                      <Text className="text-sm font-medium text-foreground">{getDisplayName(person)}</Text>
                      <Text className="text-xs text-muted">
                        {person.isAlive ? "Living" : "Deceased"}
                        {person.birthDate ? ` · Born ${person.birthDate}` : ""}
                      </Text>
                    </View>
                    <IconSymbol name="chevron.right" size={16} color={colors.muted} />
                  </View>
                </Pressable>
              ))}
            </View>
          </>
        )}

        {/* Empty State */}
        {totalMembers === 0 && (
          <View className="items-center py-12">
            <View className="w-20 h-20 rounded-full bg-primary/10 items-center justify-center mb-4">
              <IconSymbol name="tree" size={40} color={colors.primary} />
            </View>
            <Text className="text-xl font-semibold text-foreground mb-2">Start Your Family Tree</Text>
            <Text className="text-sm text-muted text-center px-8 mb-6">
              Begin by adding yourself as the first member, then grow your tree by adding parents, siblings, and children.
            </Text>
            <Pressable
              onPress={() => router.push("/add-member" as any)}
              style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}
            >
              <View className="bg-primary rounded-full px-8 py-3">
                <Text className="text-white font-semibold text-base">Add First Member</Text>
              </View>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
