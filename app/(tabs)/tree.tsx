import { Text, View, Pressable, ScrollView, Dimensions, TextInput } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useFamily } from "@/lib/family-store";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { getDisplayName, Person } from "@/lib/types";
import { useMemo, useState } from "react";

interface TreeNode {
  person: Person;
  spouses: Person[];
  children: TreeNode[];
  level: number;
}

function useTreeData() {
  const { data, getChildren, getSpouses } = useFamily();

  return useMemo(() => {
    if (data.persons.length === 0) return null;

    const rootId = data.rootPersonId || data.persons[0]?.id;
    if (!rootId) return null;

    const rootPerson = data.persons.find((p) => p.id === rootId);
    if (!rootPerson) return null;

    const visited = new Set<string>();

    function buildNode(person: Person, level: number): TreeNode {
      if (visited.has(person.id)) {
        return { person, spouses: [], children: [], level };
      }
      visited.add(person.id);

      const spouses = getSpouses(person.id);
      const children = getChildren(person.id);
      const uniqueChildren = children.filter((c) => !visited.has(c.id));

      return {
        person,
        spouses,
        children: uniqueChildren.map((c) => buildNode(c, level + 1)),
        level,
      };
    }

    return buildNode(rootPerson, 0);
  }, [data]);
}

function PersonAvatar({ person, size, colors }: {
  person: Person;
  size: number;
  colors: ReturnType<typeof useColors>;
}) {
  const borderColor = person.isAlive ? colors.primary : colors.muted;

  if (person.photo) {
    return (
      <Image
        source={{ uri: person.photo }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        contentFit="cover"
      />
    );
  }

  return (
    <View
      className="items-center justify-center"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: borderColor + "20",
      }}
    >
      <Text className="font-bold" style={{ color: borderColor, fontSize: size * 0.4 }}>
        {person.firstName.charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

function PersonNode({ person, isRoot, onPress, colors }: {
  person: Person;
  isRoot?: boolean;
  onPress: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  const borderColor = person.isAlive ? colors.primary : colors.muted;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
      <View
        className="items-center rounded-2xl p-3 bg-surface border-2 min-w-[100px]"
        style={{ borderColor }}
      >
        <PersonAvatar person={person} size={48} colors={colors} />
        <Text className="text-xs font-semibold text-foreground text-center mt-1" numberOfLines={2}>
          {person.prefix ? `${person.prefix} ` : ""}{person.firstName}
        </Text>
        {person.binBinti && (
          <Text className="text-[10px] text-muted text-center" numberOfLines={1}>
            {person.gender === "male" ? "bin" : "binti"} {person.binBinti}
          </Text>
        )}
        {isRoot && (
          <View className="bg-primary/20 rounded-full px-2 py-0.5 mt-1">
            <Text className="text-[9px] font-medium" style={{ color: colors.primary }}>ROOT</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

function TreeLevel({ node, router, colors, rootId }: {
  node: TreeNode;
  router: ReturnType<typeof useRouter>;
  colors: ReturnType<typeof useColors>;
  rootId?: string;
}) {
  return (
    <View className="items-center">
      <View className="flex-row items-center gap-2">
        <PersonNode
          person={node.person}
          isRoot={node.person.id === rootId}
          onPress={() => router.push({ pathname: "/member-profile" as any, params: { id: node.person.id } })}
          colors={colors}
        />
        {node.spouses.map((spouse) => (
          <View key={spouse.id} className="flex-row items-center gap-2">
            <View className="w-6 h-0.5" style={{ backgroundColor: colors.accent }} />
            <PersonNode
              person={spouse}
              onPress={() => router.push({ pathname: "/member-profile" as any, params: { id: spouse.id } })}
              colors={colors}
            />
          </View>
        ))}
      </View>

      {node.children.length > 0 && (
        <View className="w-0.5 h-6" style={{ backgroundColor: colors.border }} />
      )}

      {node.children.length > 0 && (
        <View className="flex-row gap-4 items-start">
          {node.children.map((child) => (
            <View key={child.person.id} className="items-center">
              {node.children.length > 1 && (
                <View className="w-0.5 h-3" style={{ backgroundColor: colors.border }} />
              )}
              <TreeLevel node={child} router={router} colors={colors} rootId={rootId} />
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

export default function TreeScreen() {
  const router = useRouter();
  const colors = useColors();
  const { data } = useFamily();
  const treeData = useTreeData();
  const [searchQuery, setSearchQuery] = useState("");

  const filteredPersons = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return data.persons.filter((p) =>
      getDisplayName(p).toLowerCase().includes(q) ||
      (p.race && p.race.toLowerCase().includes(q)) ||
      (p.religion && p.religion.toLowerCase().includes(q))
    );
  }, [searchQuery, data.persons]);

  return (
    <ScreenContainer className="pt-2">
      {/* Header */}
      <View className="flex-row items-center justify-between px-5 mb-3">
        <View>
          <Text className="text-2xl font-bold text-foreground">Family Tree</Text>
          <Text className="text-sm text-muted">{data.persons.length} members</Text>
        </View>
        <Pressable
          onPress={() => router.push("/add-member" as any)}
          style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
        >
          <View className="w-10 h-10 rounded-full bg-primary items-center justify-center">
            <IconSymbol name="plus.circle.fill" size={22} color="#fff" />
          </View>
        </Pressable>
      </View>

      {/* Search Bar */}
      {data.persons.length > 0 && (
        <View className="px-5 mb-3">
          <View className="flex-row items-center bg-surface border border-border rounded-xl px-3 gap-2">
            <IconSymbol name="magnifyingglass" size={18} color={colors.muted} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search by name, ethnicity, religion..."
              placeholderTextColor={colors.muted}
              className="flex-1 py-2.5 text-sm"
              style={{ color: colors.foreground }}
              returnKeyType="done"
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery("")} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
                <IconSymbol name="xmark" size={16} color={colors.muted} />
              </Pressable>
            )}
          </View>
        </View>
      )}

      {/* Search Results */}
      {searchQuery.trim().length > 0 ? (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
          <Text className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">
            {filteredPersons.length} result{filteredPersons.length !== 1 ? "s" : ""}
          </Text>
          {filteredPersons.map((person) => (
            <Pressable
              key={person.id}
              onPress={() => router.push({ pathname: "/member-profile" as any, params: { id: person.id } })}
              style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
            >
              <View className="flex-row items-center bg-surface rounded-xl p-3 border border-border gap-3 mb-2">
                <PersonAvatar person={person} size={40} colors={colors} />
                <View className="flex-1">
                  <Text className="text-sm font-medium text-foreground">{getDisplayName(person)}</Text>
                  <Text className="text-xs text-muted">
                    {person.isAlive ? "Living" : "Deceased"}
                    {person.race ? ` · ${person.race}` : ""}
                    {person.religion ? ` · ${person.religion}` : ""}
                  </Text>
                </View>
                <IconSymbol name="chevron.right" size={16} color={colors.muted} />
              </View>
            </Pressable>
          ))}
          {filteredPersons.length === 0 && (
            <View className="items-center py-8">
              <Text className="text-sm text-muted">No members found matching "{searchQuery}"</Text>
            </View>
          )}
        </ScrollView>
      ) : treeData ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ padding: 20, minWidth: Dimensions.get("window").width }}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ alignItems: "center", paddingBottom: 40 }}
          >
            <TreeLevel node={treeData} router={router} colors={colors} rootId={data.rootPersonId} />
          </ScrollView>
        </ScrollView>
      ) : (
        <View className="flex-1 items-center justify-center px-8">
          <View className="w-20 h-20 rounded-full bg-primary/10 items-center justify-center mb-4">
            <IconSymbol name="tree" size={40} color={colors.primary} />
          </View>
          <Text className="text-xl font-semibold text-foreground mb-2 text-center">No Family Tree Yet</Text>
          <Text className="text-sm text-muted text-center mb-6">
            Add your first family member to start building your tree.
          </Text>
          <Pressable
            onPress={() => router.push("/add-member" as any)}
            style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}
          >
            <View className="bg-primary rounded-full px-8 py-3">
              <Text className="text-white font-semibold">Add First Member</Text>
            </View>
          </Pressable>
        </View>
      )}
    </ScreenContainer>
  );
}
