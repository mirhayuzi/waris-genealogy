import { Text, View, Pressable, ScrollView, FlatList } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useFamily } from "@/lib/family-store";
import { getDisplayName, Person } from "@/lib/types";
import { useState, useMemo } from "react";
import { useI18n } from "@/lib/i18n";

function PersonAvatar({ person, size, colors }: {
  person: Person;
  size: number;
  colors: ReturnType<typeof useColors>;
}) {
  if (person.photoUrl) {
    return (
      <Image
        source={{ uri: person.photoUrl }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        contentFit="cover"
      />
    );
  }
  const bgColor = person.isAlive ? colors.primary + "20" : colors.muted + "20";
  const textColor = person.isAlive ? colors.primary : colors.muted;
  return (
    <View
      style={{
        width: size, height: size, borderRadius: size / 2,
        backgroundColor: bgColor, alignItems: "center", justifyContent: "center",
      }}
    >
      <Text style={{ fontWeight: "700", color: textColor, fontSize: size * 0.4 }}>
        {person.firstName.charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

interface Column {
  title: string;
  persons: Person[];
  selectedId?: string;
}

export default function MillerColumnsScreen() {
  const router = useRouter();
  const colors = useColors();
  const { data, getChildren, getSpouses, getParents, getSiblings } = useFamily();
  const { t } = useI18n();
  const [columns, setColumns] = useState<Column[]>([]);
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);

  // Initial column: root members (persons without parents)
  const rootPersons = useMemo(() => {
    const childIds = new Set(data.parentChildren.map((pc) => pc.childId));
    const roots = data.persons.filter((p) => !childIds.has(p.id));
    return roots.length > 0 ? roots : data.persons.slice(0, 10);
  }, [data]);

  // Initialize with root column
  const allColumns = useMemo(() => {
    if (columns.length === 0) {
      return [{ title: data.familyName, persons: rootPersons, selectedId: undefined }];
    }
    return columns;
  }, [columns, rootPersons, data.familyName]);

  const handleSelectPerson = (person: Person, columnIndex: number) => {
    setSelectedPerson(person);

    // Get children for next column
    const children = getChildren(person.id);
    const spouses = getSpouses(person.id);

    // Build next column items
    const nextPersons: Person[] = [];
    spouses.forEach((s) => {
      if (!nextPersons.find((p) => p.id === s.id)) nextPersons.push(s);
    });
    children.forEach((c) => {
      if (!nextPersons.find((p) => p.id === c.id)) nextPersons.push(c);
    });

    // Update columns: keep up to columnIndex, update selected, add next column
    const updatedColumns = allColumns.slice(0, columnIndex + 1);
    updatedColumns[columnIndex] = { ...updatedColumns[columnIndex], selectedId: person.id };

    if (nextPersons.length > 0) {
      const spouseIds = new Set(spouses.map((s) => s.id));
      const childrenIds = new Set(children.map((c) => c.id));
      let title = person.firstName + "'s";
      if (spouses.length > 0 && children.length > 0) {
        title += " Family";
      } else if (children.length > 0) {
        title += " Children";
      } else {
        title += " Spouse(s)";
      }
      updatedColumns.push({ title, persons: nextPersons, selectedId: undefined });
    }

    setColumns(updatedColumns);
  };

  const navigateToProfile = (person: Person) => {
    router.push({ pathname: "/member-profile" as any, params: { id: person.id } });
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
        <Text className="text-xl font-bold text-foreground flex-1">{t("millerColumns")}</Text>
        <Text className="text-xs text-muted">{data.persons.length} {t("members")}</Text>
      </View>

      {data.persons.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <View className="w-16 h-16 rounded-full bg-primary/10 items-center justify-center mb-4">
            <IconSymbol name="list.bullet" size={32} color={colors.primary} />
          </View>
          <Text className="text-base font-semibold text-foreground mb-2 text-center">{t("noFamilyTreeYet")}</Text>
        </View>
      ) : (
        <View className="flex-1">
          {/* Miller Columns - horizontal scroll */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 12 }}
          >
            {allColumns.map((col, colIdx) => (
              <View
                key={`col-${colIdx}-${col.title}`}
                style={{
                  width: 220,
                  marginRight: 8,
                  backgroundColor: colors.surface,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: colors.border,
                  overflow: "hidden",
                }}
              >
                {/* Column Header */}
                <View style={{
                  paddingHorizontal: 12, paddingVertical: 10,
                  borderBottomWidth: 1, borderBottomColor: colors.border,
                  backgroundColor: colors.primary + "08",
                }}>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: colors.foreground }} numberOfLines={1}>
                    {col.title}
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.muted, marginTop: 2 }}>
                    {col.persons.length} {col.persons.length === 1 ? "person" : "people"}
                  </Text>
                </View>

                {/* Column Items */}
                <FlatList
                  data={col.persons}
                  keyExtractor={(item) => item.id}
                  showsVerticalScrollIndicator={false}
                  renderItem={({ item }) => {
                    const isSelected = col.selectedId === item.id;
                    const hasChildren = getChildren(item.id).length > 0;
                    const hasSpouse = getSpouses(item.id).length > 0;

                    return (
                      <Pressable
                        onPress={() => handleSelectPerson(item, colIdx)}
                        onLongPress={() => navigateToProfile(item)}
                        style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
                      >
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            paddingHorizontal: 12,
                            paddingVertical: 10,
                            gap: 10,
                            backgroundColor: isSelected ? colors.primary + "12" : "transparent",
                            borderBottomWidth: 0.5,
                            borderBottomColor: colors.border,
                          }}
                        >
                          <PersonAvatar person={item} size={36} colors={colors} />
                          <View style={{ flex: 1 }}>
                            <Text
                              style={{
                                fontSize: 13, fontWeight: isSelected ? "700" : "500",
                                color: isSelected ? colors.primary : colors.foreground,
                              }}
                              numberOfLines={1}
                            >
                              {item.prefix ? `${item.prefix} ` : ""}{item.firstName}
                            </Text>
                            <Text style={{ fontSize: 11, color: colors.muted }} numberOfLines={1}>
                              {item.isAlive ? "●" : "○"} {item.gender === "male" ? "M" : "F"}
                              {item.race ? ` · ${item.race}` : ""}
                            </Text>
                          </View>
                          {(hasChildren || hasSpouse) && (
                            <IconSymbol name="chevron.right" size={14} color={isSelected ? colors.primary : colors.muted} />
                          )}
                        </View>
                      </Pressable>
                    );
                  }}
                />
              </View>
            ))}
          </ScrollView>

          {/* Selected Person Detail Panel */}
          {selectedPerson && (
            <View className="mx-4 mt-3 mb-4 bg-surface rounded-2xl border border-border p-4">
              <View className="flex-row items-center gap-3 mb-3">
                <PersonAvatar person={selectedPerson} size={48} colors={colors} />
                <View className="flex-1">
                  <Text className="text-base font-semibold text-foreground">{getDisplayName(selectedPerson)}</Text>
                  <Text className="text-xs text-muted">
                    {selectedPerson.isAlive ? t("living") : t("deceased")}
                    {selectedPerson.race ? ` · ${selectedPerson.race}` : ""}
                    {selectedPerson.religion ? ` · ${selectedPerson.religion}` : ""}
                  </Text>
                </View>
              </View>
              <View className="flex-row gap-2">
                <Pressable
                  onPress={() => navigateToProfile(selectedPerson)}
                  style={({ pressed }) => [{ flex: 1, opacity: pressed ? 0.8 : 1 }]}
                >
                  <View className="bg-primary rounded-xl py-2.5 items-center">
                    <Text className="text-xs font-semibold text-white">View Profile</Text>
                  </View>
                </Pressable>
                <Pressable
                  onPress={() => router.push({ pathname: "/edit-member" as any, params: { id: selectedPerson.id } })}
                  style={({ pressed }) => [{ flex: 1, opacity: pressed ? 0.8 : 1 }]}
                >
                  <View className="border border-border rounded-xl py-2.5 items-center">
                    <Text className="text-xs font-semibold text-foreground">{t("edit")}</Text>
                  </View>
                </Pressable>
              </View>
            </View>
          )}
        </View>
      )}
    </ScreenContainer>
  );
}
