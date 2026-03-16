import { Text, View, Pressable, ScrollView, TextInput, Modal, FlatList, Platform } from "react-native";
import { Image } from "expo-image";
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

function PersonPickerModal({ visible, onClose, persons, selectedId, onSelect, title, accentColor, colors }: {
  visible: boolean;
  onClose: () => void;
  persons: Person[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  title: string;
  accentColor: string;
  colors: ReturnType<typeof useColors>;
}) {
  const [search, setSearch] = useState("");

  const filtered = search.trim()
    ? persons.filter((p) => {
        const q = search.toLowerCase();
        return getDisplayName(p).toLowerCase().includes(q)
          || (p.firstName || "").toLowerCase().includes(q)
          || (p.lastName || "").toLowerCase().includes(q)
          || (p.binBinti || "").toLowerCase().includes(q);
      })
    : persons;

  return (
    <Modal visible={visible} transparent animationType="slide">
      <Pressable
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }}
        onPress={() => { onClose(); setSearch(""); }}
      >
        <Pressable style={{ maxHeight: "70%" }}>
          <View className="bg-background rounded-t-3xl" style={{ paddingBottom: Platform.OS === "ios" ? 34 : 20 }}>
            <View className="items-center py-3">
              <View className="w-10 h-1 rounded-full bg-border" />
            </View>
            <Text className="text-base font-semibold text-foreground px-5 mb-1">{title}</Text>
            <Text className="text-xs text-muted px-5 mb-3">
              Select a Muslim family member
            </Text>

            {/* Search Input */}
            <View className="px-5 mb-3">
              <View className="flex-row items-center bg-surface rounded-xl border border-border px-3 py-2 gap-2">
                <IconSymbol name="magnifyingglass" size={16} color={colors.muted} />
                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Search members..."
                  placeholderTextColor={colors.muted}
                  style={{ flex: 1, fontSize: 14, color: colors.foreground, padding: 0 }}
                  autoFocus
                  returnKeyType="done"
                />
                {search.length > 0 && (
                  <Pressable onPress={() => setSearch("")} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
                    <IconSymbol name="xmark" size={14} color={colors.muted} />
                  </Pressable>
                )}
              </View>
            </View>

            {filtered.length === 0 ? (
              <View className="px-5 py-6 items-center">
                <Text className="text-sm text-muted">
                  {search.trim() ? "No members match your search." : "No Muslim members available."}
                </Text>
              </View>
            ) : (
              <FlatList
                data={filtered}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => {
                  const isSelected = selectedId === item.id;
                  return (
                    <Pressable
                      onPress={() => { onSelect(item.id); onClose(); setSearch(""); }}
                      style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
                    >
                      <View
                        className="flex-row items-center px-5 py-3 gap-3 border-b border-border"
                        style={isSelected ? { backgroundColor: accentColor + "10" } : undefined}
                      >
                        {item.photo ? (
                          <Image source={{ uri: item.photo }} style={{ width: 36, height: 36, borderRadius: 18 }} contentFit="cover" />
                        ) : (
                          <View
                            className="w-9 h-9 rounded-full items-center justify-center"
                            style={{ backgroundColor: accentColor + "15" }}
                          >
                            <Text className="text-xs font-bold" style={{ color: accentColor }}>
                              {item.firstName.charAt(0).toUpperCase()}
                            </Text>
                          </View>
                        )}
                        <View className="flex-1">
                          <Text className="text-sm font-medium text-foreground">{getDisplayName(item)}</Text>
                          <Text className="text-xs text-muted">
                            {item.gender === "male" ? "Male" : "Female"} · {item.religion}
                          </Text>
                        </View>
                        {isSelected && (
                          <IconSymbol name="checkmark" size={16} color={accentColor} />
                        )}
                      </View>
                    </Pressable>
                  );
                }}
              />
            )}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default function MahramCheckerScreen() {
  const router = useRouter();
  const colors = useColors();
  const { data, getParents, getChildren, getSpouses, getSiblings } = useFamily();
  const [personAId, setPersonAId] = useState<string | null>(null);
  const [personBId, setPersonBId] = useState<string | null>(null);
  const [showPickerA, setShowPickerA] = useState(false);
  const [showPickerB, setShowPickerB] = useState(false);

  const personA = personAId ? data.persons.find((p) => p.id === personAId) : null;
  const personB = personBId ? data.persons.find((p) => p.id === personBId) : null;

  const result = useMemo(() => {
    if (!personA || !personB || personA.id === personB.id) return null;
    return checkMahram(personA, personB, getParents, getChildren, getSpouses, getSiblings);
  }, [personAId, personBId, data]);

  const muslimPersons = data.persons.filter((p) => p.religion === "Islam");
  const muslimPersonsForB = muslimPersons.filter((p) => p.id !== personAId);

  const renderSelectedPerson = (person: Person | null, label: string, accentColor: string, onPress: () => void) => (
    <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}>
      <View
        className="rounded-2xl border p-4 mb-4"
        style={{
          borderColor: person ? accentColor + "40" : colors.border,
          backgroundColor: person ? accentColor + "08" : colors.surface,
        }}
      >
        {person ? (
          <View className="flex-row items-center gap-3">
            {person.photo ? (
              <Image source={{ uri: person.photo }} style={{ width: 44, height: 44, borderRadius: 22 }} contentFit="cover" />
            ) : (
              <View
                className="w-11 h-11 rounded-full items-center justify-center"
                style={{ backgroundColor: accentColor + "20" }}
              >
                <Text className="text-base font-bold" style={{ color: accentColor }}>
                  {person.firstName.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <View className="flex-1">
              <Text className="text-xs text-muted uppercase tracking-wider mb-0.5">{label}</Text>
              <Text className="text-sm font-semibold text-foreground">{getDisplayName(person)}</Text>
              <Text className="text-xs text-muted">
                {person.gender === "male" ? "Male" : "Female"} · {person.religion}
              </Text>
            </View>
            <IconSymbol name="pencil" size={14} color={colors.muted} />
          </View>
        ) : (
          <View className="flex-row items-center justify-center gap-2 py-2">
            <IconSymbol name="magnifyingglass" size={16} color={accentColor} />
            <Text className="text-sm font-medium" style={{ color: accentColor }}>
              Tap to select {label}
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );

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
        {renderSelectedPerson(personA || null, "Person 1", colors.primary, () => setShowPickerA(true))}

        {/* Person B Selector */}
        <Text className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Person 2</Text>
        {renderSelectedPerson(personB || null, "Person 2", colors.accent, () => setShowPickerB(true))}

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

      {/* Person Picker Modals */}
      <PersonPickerModal
        visible={showPickerA}
        onClose={() => setShowPickerA(false)}
        persons={muslimPersons}
        selectedId={personAId}
        onSelect={setPersonAId}
        title="Select Person 1"
        accentColor={colors.primary}
        colors={colors}
      />
      <PersonPickerModal
        visible={showPickerB}
        onClose={() => setShowPickerB(false)}
        persons={muslimPersonsForB}
        selectedId={personBId}
        onSelect={setPersonBId}
        title="Select Person 2"
        accentColor={colors.accent}
        colors={colors}
      />
    </ScreenContainer>
  );
}
