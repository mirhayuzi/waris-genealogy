import { Text, View, Pressable, ScrollView, Dimensions, TextInput } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useFamily } from "@/lib/family-store";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { getDisplayName, Person } from "@/lib/types";
import { useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";

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

function PersonNode({ person, isRoot, onPress, colors, scale }: {
  person: Person;
  isRoot?: boolean;
  onPress: () => void;
  colors: ReturnType<typeof useColors>;
  scale: number;
}) {
  const borderColor = person.isAlive ? colors.primary : colors.muted;
  const avatarSize = Math.max(24, Math.round(48 * scale));
  const fontSize = Math.max(8, Math.round(12 * scale));
  const subFontSize = Math.max(7, Math.round(10 * scale));
  const padding = Math.max(4, Math.round(12 * scale));
  const minW = Math.max(60, Math.round(100 * scale));

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
      <View
        className="items-center rounded-2xl bg-surface border-2"
        style={{ borderColor, padding, minWidth: minW }}
      >
        <PersonAvatar person={person} size={avatarSize} colors={colors} />
        <Text
          className="font-semibold text-foreground text-center"
          style={{ fontSize, marginTop: 2 }}
          numberOfLines={2}
        >
          {person.prefix ? `${person.prefix} ` : ""}{person.firstName}
        </Text>
        {person.binBinti && (
          <Text className="text-muted text-center" style={{ fontSize: subFontSize }} numberOfLines={1}>
            {person.gender === "male" ? "bin" : "binti"} {person.binBinti}
          </Text>
        )}
        {isRoot && (
          <View className="bg-primary/20 rounded-full px-2 py-0.5 mt-1">
            <Text className="font-medium" style={{ color: colors.primary, fontSize: Math.max(7, Math.round(9 * scale)) }}>ROOT</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

function TreeLevel({ node, router, colors, rootId, scale }: {
  node: TreeNode;
  router: ReturnType<typeof useRouter>;
  colors: ReturnType<typeof useColors>;
  rootId?: string;
  scale: number;
}) {
  const gap = Math.max(4, Math.round(8 * scale));
  const lineH = Math.max(8, Math.round(24 * scale));
  const lineW = Math.max(8, Math.round(24 * scale));

  return (
    <View className="items-center">
      <View className="flex-row items-center" style={{ gap }}>
        <PersonNode
          person={node.person}
          isRoot={node.person.id === rootId}
          onPress={() => router.push({ pathname: "/member-profile" as any, params: { id: node.person.id } })}
          colors={colors}
          scale={scale}
        />
        {node.spouses.map((spouse) => (
          <View key={spouse.id} className="flex-row items-center" style={{ gap }}>
            <View style={{ width: lineW, height: 2, backgroundColor: colors.accent }} />
            <PersonNode
              person={spouse}
              onPress={() => router.push({ pathname: "/member-profile" as any, params: { id: spouse.id } })}
              colors={colors}
              scale={scale}
            />
          </View>
        ))}
      </View>

      {node.children.length > 0 && (
        <View style={{ width: 2, height: lineH, backgroundColor: colors.border }} />
      )}

      {node.children.length > 0 && (
        <View className="flex-row items-start" style={{ gap: Math.max(8, Math.round(16 * scale)) }}>
          {node.children.map((child) => (
            <View key={child.person.id} className="items-center">
              {node.children.length > 1 && (
                <View style={{ width: 2, height: Math.max(4, Math.round(12 * scale)), backgroundColor: colors.border }} />
              )}
              <TreeLevel node={child} router={router} colors={colors} rootId={rootId} scale={scale} />
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
  const { t } = useI18n();
  const [searchQuery, setSearchQuery] = useState("");
  const [zoom, setZoom] = useState(1.0);

  const MIN_ZOOM = 0.3;
  const MAX_ZOOM = 2.0;
  const ZOOM_STEP = 0.2;

  const handleZoomIn = () => setZoom((z) => Math.min(MAX_ZOOM, z + ZOOM_STEP));
  const handleZoomOut = () => setZoom((z) => Math.max(MIN_ZOOM, z - ZOOM_STEP));
  const handleResetZoom = () => setZoom(1.0);

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
          <Text className="text-2xl font-bold text-foreground">{t("familyTree")}</Text>
          <Text className="text-sm text-muted">{data.persons.length} {t("members")}</Text>
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
              placeholder={t("searchMembers")}
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
            {filteredPersons.length} {filteredPersons.length !== 1 ? t("results") : t("result")}
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
                    {person.isAlive ? t("living") : t("deceased")}
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
              <Text className="text-sm text-muted">{t("noMembersFound")} "{searchQuery}"</Text>
            </View>
          )}
        </ScrollView>
      ) : treeData ? (
        <View className="flex-1">
          {/* Zoom Controls */}
          <View className="flex-row items-center justify-center gap-2 px-5 mb-2">
            <Pressable onPress={handleZoomOut} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
              <View className="w-9 h-9 rounded-full bg-surface border border-border items-center justify-center">
                <IconSymbol name="minus.circle.fill" size={18} color={colors.primary} />
              </View>
            </Pressable>
            <Pressable onPress={handleResetZoom} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
              <View className="px-3 py-1.5 rounded-full bg-surface border border-border">
                <Text className="text-xs font-medium" style={{ color: colors.foreground }}>
                  {Math.round(zoom * 100)}%
                </Text>
              </View>
            </Pressable>
            <Pressable onPress={handleZoomIn} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
              <View className="w-9 h-9 rounded-full bg-surface border border-border items-center justify-center">
                <IconSymbol name="plus.circle.fill" size={18} color={colors.primary} />
              </View>
            </Pressable>
          </View>

          {/* Tree View */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ padding: 20, minWidth: Dimensions.get("window").width }}
          >
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ alignItems: "center", paddingBottom: 40 }}
            >
              <TreeLevel node={treeData} router={router} colors={colors} rootId={data.rootPersonId} scale={zoom} />
            </ScrollView>
          </ScrollView>
        </View>
      ) : (
        <View className="flex-1 items-center justify-center px-8">
          <View className="w-20 h-20 rounded-full bg-primary/10 items-center justify-center mb-4">
            <IconSymbol name="tree" size={40} color={colors.primary} />
          </View>
          <Text className="text-xl font-semibold text-foreground mb-2 text-center">{t("noFamilyTreeYet")}</Text>
          <Text className="text-sm text-muted text-center mb-6">
            {t("addFirstMemberTree")}
          </Text>
          <Pressable
            onPress={() => router.push("/add-member" as any)}
            style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}
          >
            <View className="bg-primary rounded-full px-8 py-3">
              <Text className="text-white font-semibold">{t("addFirstMember")}</Text>
            </View>
          </Pressable>
        </View>
      )}
    </ScreenContainer>
  );
}
