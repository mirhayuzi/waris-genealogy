import { Text, View, Pressable, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useFamily } from "@/lib/family-store";
import { getDisplayName, Person } from "@/lib/types";
import { useState, useMemo } from "react";

type MahramResult = {
  isMahram: boolean;
  relationship: string;
  ruling: string;
};

function checkMahram(
  personA: Person,
  personB: Person,
  getParents: (id: string) => Person[],
  getChildren: (id: string) => Person[],
  getSpouses: (id: string) => Person[],
  getSiblings: (id: string) => Person[],
): MahramResult {
  // Same gender - not applicable for Mahram in marriage context
  if (personA.gender === personB.gender) {
    return { isMahram: true, relationship: "Same gender", ruling: "Same-gender relatives are always Mahram to each other." };
  }

  // Parent-child
  const parentsA = getParents(personA.id);
  if (parentsA.some((p) => p.id === personB.id)) {
    return { isMahram: true, relationship: personB.gender === "male" ? "Father (Bapa)" : "Mother (Ibu)", ruling: "Parent and child are permanently Mahram (Nasab)." };
  }
  const parentsB = getParents(personB.id);
  if (parentsB.some((p) => p.id === personA.id)) {
    return { isMahram: true, relationship: personA.gender === "male" ? "Father (Bapa)" : "Mother (Ibu)", ruling: "Parent and child are permanently Mahram (Nasab)." };
  }

  // Siblings
  const siblingsA = getSiblings(personA.id);
  if (siblingsA.some((s) => s.id === personB.id)) {
    return { isMahram: true, relationship: "Sibling (Adik-Beradik)", ruling: "Siblings are permanently Mahram (Nasab)." };
  }

  // Spouse
  const spousesA = getSpouses(personA.id);
  if (spousesA.some((s) => s.id === personB.id)) {
    return { isMahram: true, relationship: "Spouse (Pasangan)", ruling: "Spouses are Mahram to each other through marriage (Musaharah)." };
  }

  // Grandparent-grandchild
  for (const parent of parentsA) {
    const grandparents = getParents(parent.id);
    if (grandparents.some((gp) => gp.id === personB.id)) {
      return { isMahram: true, relationship: "Grandparent (Datuk/Nenek)", ruling: "Grandparent and grandchild are permanently Mahram (Nasab)." };
    }
  }
  for (const parent of parentsB) {
    const grandparents = getParents(parent.id);
    if (grandparents.some((gp) => gp.id === personA.id)) {
      return { isMahram: true, relationship: "Grandparent (Datuk/Nenek)", ruling: "Grandparent and grandchild are permanently Mahram (Nasab)." };
    }
  }

  // Uncle/Aunt - Nephew/Niece
  for (const parent of parentsA) {
    const parentSiblings = getSiblings(parent.id);
    if (parentSiblings.some((ps) => ps.id === personB.id)) {
      return { isMahram: true, relationship: personB.gender === "male" ? "Uncle (Pak Cik)" : "Aunt (Mak Cik)", ruling: "Uncle/Aunt and nephew/niece are permanently Mahram (Nasab)." };
    }
  }
  for (const parent of parentsB) {
    const parentSiblings = getSiblings(parent.id);
    if (parentSiblings.some((ps) => ps.id === personA.id)) {
      return { isMahram: true, relationship: personA.gender === "male" ? "Uncle (Pak Cik)" : "Aunt (Mak Cik)", ruling: "Uncle/Aunt and nephew/niece are permanently Mahram (Nasab)." };
    }
  }

  // In-law: Parent of spouse
  for (const spouse of spousesA) {
    const spouseParents = getParents(spouse.id);
    if (spouseParents.some((sp) => sp.id === personB.id)) {
      return { isMahram: true, relationship: "Parent-in-law (Mertua)", ruling: "Parent-in-law is Mahram through marriage (Musaharah)." };
    }
  }
  for (const spouse of getSpouses(personB.id)) {
    const spouseParents = getParents(spouse.id);
    if (spouseParents.some((sp) => sp.id === personA.id)) {
      return { isMahram: true, relationship: "Parent-in-law (Mertua)", ruling: "Parent-in-law is Mahram through marriage (Musaharah)." };
    }
  }

  return { isMahram: false, relationship: "Not Mahram", ruling: "No Mahram relationship found between these two people based on the family tree data. They are non-Mahram (Ajnabi)." };
}

export default function MahramCheckerScreen() {
  const router = useRouter();
  const colors = useColors();
  const { data, getParents, getChildren, getSpouses, getSiblings } = useFamily();
  const [personAId, setPersonAId] = useState<string | null>(null);
  const [personBId, setPersonBId] = useState<string | null>(null);

  const personA = personAId ? data.persons.find((p) => p.id === personAId) : null;
  const personB = personBId ? data.persons.find((p) => p.id === personBId) : null;

  const result = useMemo(() => {
    if (!personA || !personB || personA.id === personB.id) return null;
    return checkMahram(personA, personB, getParents, getChildren, getSpouses, getSiblings);
  }, [personAId, personBId, data]);

  const muslimPersons = data.persons.filter((p) => p.religion === "Islam");

  return (
    <ScreenContainer className="pt-2">
      <View className="flex-row items-center justify-between px-5 mb-4">
        <Pressable onPress={() => router.back()} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
          <View className="flex-row items-center gap-1">
            <IconSymbol name="chevron.left" size={20} color={colors.primary} />
            <Text className="text-sm text-primary">Back</Text>
          </View>
        </Pressable>
        <Text className="text-lg font-semibold text-foreground">Mahram Checker</Text>
        <View className="w-12" />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: 20 }}>
        <View className="bg-primary/8 rounded-2xl p-4 border border-primary/20 mb-6">
          <Text className="text-sm font-medium text-foreground mb-1">Mahram Relationship Checker</Text>
          <Text className="text-xs text-muted leading-relaxed">
            Select two Muslim family members to check if they are Mahram (unmarriageable kin) 
            to each other based on Nasab (blood), Musaharah (marriage), or Radha'ah (breastfeeding).
          </Text>
        </View>

        {/* Person A Selector */}
        <Text className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Person 1</Text>
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
        <Text className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Person 2</Text>
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
                {result.isMahram ? "MAHRAM" : "NOT MAHRAM"}
              </Text>
            </View>

            <View className="bg-background/50 rounded-xl p-3 gap-2">
              <View className="flex-row justify-between">
                <Text className="text-xs text-muted">Person 1</Text>
                <Text className="text-xs font-medium text-foreground">{getDisplayName(personA)}</Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-xs text-muted">Person 2</Text>
                <Text className="text-xs font-medium text-foreground">{getDisplayName(personB)}</Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-xs text-muted">Relationship</Text>
                <Text className="text-xs font-medium text-foreground">{result.relationship}</Text>
              </View>
            </View>

            <Text className="text-xs text-muted mt-3 leading-relaxed">{result.ruling}</Text>
          </View>
        )}

        {personAId && personBId && personAId === personBId && (
          <View className="bg-warning/10 rounded-2xl p-4 border border-warning/30">
            <Text className="text-sm text-foreground text-center">Please select two different people.</Text>
          </View>
        )}

        {muslimPersons.length < 2 && (
          <View className="bg-surface rounded-2xl p-6 border border-border items-center">
            <Text className="text-sm text-muted text-center">
              You need at least 2 Muslim family members to use the Mahram Checker. Add more members first.
            </Text>
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
