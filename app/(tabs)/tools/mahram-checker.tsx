import { Text, View, Pressable, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useFamily } from "@/lib/family-store";
import { getDisplayName, Person } from "@/lib/types";
import { useState, useMemo } from "react";
import { useI18n } from "@/lib/i18n";
import { checkMahram } from "@/lib/mahram";

export default function MahramCheckerScreen() {
  const router = useRouter();
  const colors = useColors();
  const { t } = useI18n();
  const { data } = useFamily();
  const [personAId, setPersonAId] = useState<string | null>(null);
  const [personBId, setPersonBId] = useState<string | null>(null);

  const personA = personAId ? data.persons.find((p) => p.id === personAId) : null;
  const personB = personBId ? data.persons.find((p) => p.id === personBId) : null;

  const result = useMemo(() => {
    if (!personA || !personB) return null;
    return checkMahram(personA, personB, data);
  }, [personAId, personBId, data]);

  // Extract BM strings for UI
  const relationship = result?.labelBm ?? "";
  const ruling = result?.reasonBm ?? "";

  const muslimPersons = data.persons.filter((p) => p.religion === "Islam");

  return (
    <ScreenContainer className="pt-2">
      <View className="flex-row items-center justify-between px-5 mb-4">
        <Pressable onPress={() => router.back()} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
          <View className="flex-row items-center gap-1">
            <IconSymbol name="chevron.left" size={20} color={colors.primary} />
            <Text className="text-sm text-primary">{t("back")}</Text>
          </View>
        </Pressable>
        <Text className="text-lg font-semibold text-foreground">{t("mahramTitle")}</Text>
        <View className="w-12" />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: 20 }}>
        <View className="bg-primary/8 rounded-2xl p-4 border border-primary/20 mb-6">
          <Text className="text-sm font-medium text-foreground mb-1">{t("mahramRelationship")}</Text>
          <Text className="text-xs text-muted leading-relaxed">
            {t("mahramDesc")}
          </Text>
        </View>

        {/* Person A Selector */}
        <Text className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">{t("person1")}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
          <View className="flex-row gap-2">
            {muslimPersons.map((person) => (
              <Pressable
                key={person.id}
                onPress={() => setPersonAId(person.id)}
                style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}
              >
                <View
                  className="px-4 py-2.5 rounded-xl border"
                  style={{
                    backgroundColor: personAId === person.id ? colors.primary : "transparent",
                    borderColor: personAId === person.id ? colors.primary : colors.border,
                  }}
                >
                  <Text
                    className="text-sm font-medium"
                    style={{ color: personAId === person.id ? "#fff" : colors.foreground }}
                  >
                    {person.firstName}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        </ScrollView>

        {/* Person B Selector */}
        <Text className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">{t("person2")}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-6">
          <View className="flex-row gap-2">
            {muslimPersons.filter((p) => p.id !== personAId).map((person) => (
              <Pressable
                key={person.id}
                onPress={() => setPersonBId(person.id)}
                style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}
              >
                <View
                  className="px-4 py-2.5 rounded-xl border"
                  style={{
                    backgroundColor: personBId === person.id ? colors.accent : "transparent",
                    borderColor: personBId === person.id ? colors.accent : colors.border,
                  }}
                >
                  <Text
                    className="text-sm font-medium"
                    style={{ color: personBId === person.id ? "#fff" : colors.foreground }}
                  >
                    {person.firstName}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        </ScrollView>

        {/* Result */}
        {result && personA && personB && (
          <View
            className="rounded-2xl p-5 border"
            style={{
              backgroundColor: result.isMahram ? colors.success + "10" : colors.error + "10",
              borderColor: result.isMahram ? colors.success + "30" : colors.error + "30",
            }}
          >
            <View className="items-center mb-3">
              <View
                className="w-16 h-16 rounded-full items-center justify-center mb-2"
                style={{ backgroundColor: result.isMahram ? colors.success + "20" : colors.error + "20" }}
              >
                <IconSymbol
                  name={result.isMahram ? "checkmark" : "xmark"}
                  size={32}
                  color={result.isMahram ? colors.success : colors.error}
                />
              </View>
              <Text className="text-xl font-bold text-foreground">
                {result.isMahram ? t("mahram") : t("notMahram")}
              </Text>
            </View>

            <View className="bg-background/50 rounded-xl p-3 gap-2">
              <View className="flex-row justify-between">
                <Text className="text-xs text-muted">{t("person1")}</Text>
                <Text className="text-xs font-medium text-foreground">{getDisplayName(personA)}</Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-xs text-muted">{t("person2")}</Text>
                <Text className="text-xs font-medium text-foreground">{getDisplayName(personB)}</Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-xs text-muted">{t("relationship")}</Text>
                <Text className="text-xs font-medium text-foreground">{relationship}</Text>
              </View>
            </View>

            <Text className="text-xs text-muted mt-3 leading-relaxed">{ruling}</Text>
          </View>
        )}

        {personAId && personBId && personAId === personBId && (
          <View className="bg-warning/10 rounded-2xl p-4 border border-warning/30">
            <Text className="text-sm text-foreground text-center">{t("selectDifferentPeople")}</Text>
          </View>
        )}

        {muslimPersons.length < 2 && (
          <View className="bg-surface rounded-2xl p-6 border border-border items-center">
            <Text className="text-sm text-muted text-center">
              {t("needMoreMuslims")}
            </Text>
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
