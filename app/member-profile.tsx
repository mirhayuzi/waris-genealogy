import { Text, View, Pressable, ScrollView, Alert, FlatList } from "react-native";
import { Image } from "expo-image";
import { useRouter, useLocalSearchParams } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useFamily } from "@/lib/family-store";
import { getDisplayName, Person } from "@/lib/types";
import { useI18n } from "@/lib/i18n";
import { useState, useMemo } from "react";

type TabKey = "details" | "spouse" | "parents" | "children" | "grandchildren" | "great-grandchildren" | "siblings" | "uncle-aunt" | "nephew-niece" | "cousin1" | "cousin2" | "cousin3" | "in-law" | "great-uncle-aunt";

function InfoRow({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <View className="flex-row justify-between py-2.5 border-b border-border">
      <Text className="text-sm text-muted">{label}</Text>
      <Text className="text-sm font-medium text-foreground flex-shrink" numberOfLines={1}>{value}</Text>
    </View>
  );
}

function PersonListItem({ person, onPress, colors }: {
  person: Person;
  onPress: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
      <View className="flex-row items-center bg-surface rounded-xl p-3 border border-border gap-3 mb-2">
        {person.photoUrl ? (
          <Image source={{ uri: person.photoUrl }} style={{ width: 40, height: 40, borderRadius: 20 }} contentFit="cover" />
        ) : (
          <View
            className="w-10 h-10 rounded-full items-center justify-center"
            style={{ backgroundColor: (person.isAlive ? colors.primary : colors.muted) + "20" }}
          >
            <Text className="text-sm font-bold" style={{ color: person.isAlive ? colors.primary : colors.muted }}>
              {person.firstName.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        <View className="flex-1">
          <Text className="text-sm font-medium text-foreground">{getDisplayName(person)}</Text>
          <Text className="text-xs text-muted">
            {person.isAlive ? "Living" : "Deceased"}
            {person.birthDate ? ` · b. ${person.birthDate}` : ""}
          </Text>
        </View>
        <IconSymbol name="chevron.right" size={14} color={colors.muted} />
      </View>
    </Pressable>
  );
}

export default function MemberProfileScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const { getPersonById, getParents, getChildren, getSpouses, getSiblings, deletePerson, data, setRootPerson } = useFamily();
  const { t, lang } = useI18n();
  const [activeTab, setActiveTab] = useState<TabKey>("details");

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

  const parents = getParents(person.id);
  const children = getChildren(person.id);
  const spouses = getSpouses(person.id);
  const siblings = getSiblings(person.id);

  // Helper: get unique persons from IDs
  const getPersonsByIds = (ids: string[]): Person[] => {
    const unique = [...new Set(ids)];
    return unique.map((pid) => data.persons.find((p) => p.id === pid)).filter(Boolean) as Person[];
  };

  // Compute grandchildren: children of children
  const grandchildren = useMemo(() => {
    const result: Person[] = [];
    const seen = new Set<string>();
    for (const child of children) {
      for (const gc of getChildren(child.id)) {
        if (!seen.has(gc.id)) {
          seen.add(gc.id);
          result.push(gc);
        }
      }
    }
    return result;
  }, [children, getChildren]);

  // Compute great-grandchildren: children of grandchildren
  const greatGrandchildren = useMemo(() => {
    const result: Person[] = [];
    const seen = new Set<string>();
    for (const gc of grandchildren) {
      for (const ggc of getChildren(gc.id)) {
        if (!seen.has(ggc.id)) {
          seen.add(ggc.id);
          result.push(ggc);
        }
      }
    }
    return result;
  }, [grandchildren, getChildren]);

  // Pakcik / Makcik (Uncles / Aunts) — siblings of parents
  const unclesAunts = useMemo(() => {
    const ids: string[] = [];
    for (const parent of parents) {
      for (const sib of getSiblings(parent.id)) {
        if (sib.id !== person.id) ids.push(sib.id);
      }
    }
    return getPersonsByIds(ids);
  }, [parents, getSiblings, person.id, data.persons]);

  // Anak Buah (Nieces / Nephews) — children of siblings
  const nephewsNieces = useMemo(() => {
    const ids: string[] = [];
    for (const sib of siblings) {
      for (const child of getChildren(sib.id)) {
        ids.push(child.id);
      }
    }
    return getPersonsByIds(ids);
  }, [siblings, getChildren, data.persons]);

  // Sepupu 1 kali (1st Cousins) — children of uncles/aunts
  const cousins1 = useMemo(() => {
    const ids: string[] = [];
    for (const ua of unclesAunts) {
      for (const child of getChildren(ua.id)) {
        if (child.id !== person.id) ids.push(child.id);
      }
    }
    return getPersonsByIds(ids);
  }, [unclesAunts, getChildren, person.id, data.persons]);

  // Sepupu 2 kali (2nd Cousins) — children of parent's 1st cousins
  const cousins2 = useMemo(() => {
    // Get parent's cousins (parent's parent's siblings' children)
    const parentCousins = new Set<string>();
    for (const parent of parents) {
      const grandparents = getParents(parent.id);
      for (const gp of grandparents) {
        const gpSiblings = getSiblings(gp.id);
        for (const gpSib of gpSiblings) {
          for (const cousin of getChildren(gpSib.id)) {
            if (cousin.id !== parent.id) parentCousins.add(cousin.id);
          }
        }
      }
    }
    // Children of parent's cousins
    const ids: string[] = [];
    for (const pcId of parentCousins) {
      for (const child of getChildren(pcId)) {
        if (child.id !== person.id) ids.push(child.id);
      }
    }
    return getPersonsByIds(ids);
  }, [parents, getParents, getSiblings, getChildren, person.id, data.persons]);

  // Sepupu 3 kali (3rd Cousins) — children of parent's 2nd cousins
  const cousins3 = useMemo(() => {
    // Get grandparent's cousins
    const gpCousins = new Set<string>();
    for (const parent of parents) {
      const grandparents = getParents(parent.id);
      for (const gp of grandparents) {
        const greatGPs = getParents(gp.id);
        for (const ggp of greatGPs) {
          const ggpSiblings = getSiblings(ggp.id);
          for (const ggpSib of ggpSiblings) {
            for (const gpCousin of getChildren(ggpSib.id)) {
              if (gpCousin.id !== gp.id) gpCousins.add(gpCousin.id);
            }
          }
        }
      }
    }
    // GP cousin's grandchildren
    const parentCousins2 = new Set<string>();
    for (const gpcId of gpCousins) {
      for (const child of getChildren(gpcId)) {
        parentCousins2.add(child.id);
      }
    }
    const ids: string[] = [];
    for (const pc2Id of parentCousins2) {
      for (const child of getChildren(pc2Id)) {
        if (child.id !== person.id) ids.push(child.id);
      }
    }
    return getPersonsByIds(ids);
  }, [parents, getParents, getSiblings, getChildren, person.id, data.persons]);

  // Ipar (In-laws) — spouse's siblings + siblings' spouses
  const inLaws = useMemo(() => {
    const ids: string[] = [];
    // Spouse's siblings
    for (const spouse of spouses) {
      for (const sib of getSiblings(spouse.id)) {
        if (sib.id !== person.id) ids.push(sib.id);
      }
    }
    // Siblings' spouses
    for (const sib of siblings) {
      for (const spouse of getSpouses(sib.id)) {
        if (spouse.id !== person.id) ids.push(spouse.id);
      }
    }
    return getPersonsByIds(ids);
  }, [spouses, siblings, getSiblings, getSpouses, person.id, data.persons]);

  // Datuk Saudara / Nenek Saudara (Great-uncles / Great-aunts) — siblings of grandparents
  const greatUnclesAunts = useMemo(() => {
    const ids: string[] = [];
    for (const parent of parents) {
      const grandparents = getParents(parent.id);
      for (const gp of grandparents) {
        for (const sib of getSiblings(gp.id)) {
          ids.push(sib.id);
        }
      }
    }
    return getPersonsByIds(ids);
  }, [parents, getParents, getSiblings, data.persons]);

  const navigateToPerson = (personId: string) => {
    router.push({ pathname: "/member-profile" as any, params: { id: personId } });
  };

  const handleDelete = () => {
    Alert.alert(
      lang === "bm" ? "Padam Ahli" : "Delete Member",
      lang === "bm"
        ? `Adakah anda pasti mahu membuang ${getDisplayName(person)} dari salasilah keluarga?`
        : `Are you sure you want to remove ${getDisplayName(person)} from the family tree?`,
      [
        { text: t("cancel"), style: "cancel" },
        { text: t("delete"), style: "destructive", onPress: () => { router.back(); setTimeout(() => deletePerson(person.id), 300); } },
      ]
    );
  };

  const isRoot = data.rootPersonId === person.id;

  // Tab definitions with counts
  const tabs: { key: TabKey; label: string; count?: number }[] = [
    { key: "details", label: lang === "bm" ? "Maklumat" : "Details" },
    { key: "spouse", label: lang === "bm" ? "Pasangan" : "Spouse", count: spouses.length },
    { key: "parents", label: lang === "bm" ? "Ibu Bapa" : "Parents", count: parents.length },
    { key: "children", label: lang === "bm" ? "Anak" : "Children", count: children.length },
    { key: "grandchildren", label: lang === "bm" ? "Cucu" : "Grandchild", count: grandchildren.length },
    { key: "great-grandchildren", label: lang === "bm" ? "Cicit" : "Great-grandchild", count: greatGrandchildren.length },
    { key: "siblings", label: lang === "bm" ? "Adik-Beradik" : "Siblings", count: siblings.length },
    { key: "uncle-aunt", label: lang === "bm" ? "Pakcik/Makcik" : "Uncle/Aunt", count: unclesAunts.length },
    { key: "nephew-niece", label: lang === "bm" ? "Anak Buah" : "Nephew/Niece", count: nephewsNieces.length },
    { key: "cousin1", label: lang === "bm" ? "Sepupu 1" : "1st Cousin", count: cousins1.length },
    { key: "cousin2", label: lang === "bm" ? "Sepupu 2" : "2nd Cousin", count: cousins2.length },
    { key: "cousin3", label: lang === "bm" ? "Sepupu 3" : "3rd Cousin", count: cousins3.length },
    { key: "in-law", label: lang === "bm" ? "Ipar" : "In-Law", count: inLaws.length },
    { key: "great-uncle-aunt", label: lang === "bm" ? "Datuk/Nenek Saudara" : "Great-Uncle/Aunt", count: greatUnclesAunts.length },
  ];

  const getTabContent = () => {
    switch (activeTab) {
      case "details":
        return (
          <View className="bg-surface rounded-2xl px-4 border border-border">
            <InfoRow label={lang === "bm" ? "Gelaran" : "Prefix"} value={person.prefix} />
            <InfoRow label={lang === "bm" ? "Nama Pertama" : "First Name"} value={person.firstName} />
            <InfoRow label={person.gender === "male" ? "Bin" : "Binti"} value={person.binBinti} />
            <InfoRow label={lang === "bm" ? "Nama Akhir" : "Last Name"} value={person.lastName} />
            <InfoRow label={lang === "bm" ? "Jantina" : "Gender"} value={person.gender === "male" ? (lang === "bm" ? "Lelaki" : "Male") : (lang === "bm" ? "Perempuan" : "Female")} />
            <InfoRow label={lang === "bm" ? "Tarikh Lahir" : "Date of Birth"} value={person.birthDate} />
            <InfoRow label={lang === "bm" ? "Tempat Lahir" : "Place of Birth"} value={person.birthPlace} />
            {!person.isAlive && <InfoRow label={lang === "bm" ? "Tarikh Meninggal" : "Date of Death"} value={person.deathDate} />}
            <InfoRow label={lang === "bm" ? "Etnik" : "Ethnicity"} value={person.race} />
            <InfoRow label={lang === "bm" ? "Agama" : "Religion"} value={person.religion} />
            {person.bio && <InfoRow label={lang === "bm" ? "Nota" : "Notes"} value={person.bio} />}
          </View>
        );
      case "spouse":
        return renderPersonList(spouses, lang === "bm" ? "Tiada pasangan direkodkan" : "No spouse recorded");
      case "parents":
        return renderPersonList(parents, lang === "bm" ? "Tiada ibu bapa direkodkan" : "No parents recorded");
      case "children":
        return renderPersonList(children, lang === "bm" ? "Tiada anak direkodkan" : "No children recorded");
      case "grandchildren":
        return renderPersonList(grandchildren, lang === "bm" ? "Tiada cucu direkodkan" : "No grandchildren recorded");
      case "great-grandchildren":
        return renderPersonList(greatGrandchildren, lang === "bm" ? "Tiada cicit direkodkan" : "No great-grandchildren recorded");
      case "siblings":
        return renderPersonList(siblings, lang === "bm" ? "Tiada adik-beradik direkodkan" : "No siblings recorded");
      case "uncle-aunt":
        return renderPersonList(unclesAunts, lang === "bm" ? "Tiada pakcik/makcik direkodkan" : "No uncles/aunts found");
      case "nephew-niece":
        return renderPersonList(nephewsNieces, lang === "bm" ? "Tiada anak buah direkodkan" : "No nephews/nieces found");
      case "cousin1":
        return renderPersonList(cousins1, lang === "bm" ? "Tiada sepupu 1 kali direkodkan" : "No 1st cousins found");
      case "cousin2":
        return renderPersonList(cousins2, lang === "bm" ? "Tiada sepupu 2 kali direkodkan" : "No 2nd cousins found");
      case "cousin3":
        return renderPersonList(cousins3, lang === "bm" ? "Tiada sepupu 3 kali direkodkan" : "No 3rd cousins found");
      case "in-law":
        return renderPersonList(inLaws, lang === "bm" ? "Tiada ipar direkodkan" : "No in-laws found");
      case "great-uncle-aunt":
        return renderPersonList(greatUnclesAunts, lang === "bm" ? "Tiada datuk/nenek saudara direkodkan" : "No great-uncles/aunts found");
      default:
        return null;
    }
  };

  const renderPersonList = (persons: Person[], emptyMsg: string) => {
    if (persons.length === 0) {
      return (
        <View className="items-center py-8">
          <IconSymbol name="person.fill" size={32} color={colors.muted} />
          <Text className="text-sm text-muted mt-2">{emptyMsg}</Text>
        </View>
      );
    }
    return (
      <View>
        {persons.map((p) => (
          <PersonListItem key={p.id} person={p} onPress={() => navigateToPerson(p.id)} colors={colors} />
        ))}
      </View>
    );
  };

  return (
    <ScreenContainer className="pt-2">
      {/* Header */}
      <View className="flex-row items-center justify-between px-5 mb-4">
        <Pressable onPress={() => router.back()} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
          <View className="flex-row items-center gap-1">
            <IconSymbol name="chevron.left" size={20} color={colors.primary} />
            <Text className="text-sm" style={{ color: colors.primary }}>{t("back")}</Text>
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
        <View className="items-center mb-4">
          {person.photoUrl ? (
            <View style={{ width: 96, height: 96, borderRadius: 48, borderWidth: 3, borderColor: person.isAlive ? colors.primary : colors.muted, overflow: "hidden", marginBottom: 12 }}>
              <Image source={{ uri: person.photoUrl }} style={{ width: 90, height: 90, borderRadius: 45 }} contentFit="cover" />
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
            <Text className="text-sm text-muted">{person.isAlive ? (lang === "bm" ? "Hidup" : "Living") : (lang === "bm" ? "Meninggal" : "Deceased")}</Text>
            {isRoot && (
              <View className="bg-primary/15 rounded-full px-2 py-0.5">
                <Text className="text-[10px] font-semibold" style={{ color: colors.primary }}>ROOT</Text>
              </View>
            )}
          </View>

          {/* Family Summary Stats */}
          <View className="flex-row items-center gap-4 mt-3">
            {spouses.length > 0 && (
              <View className="items-center">
                <Text className="text-lg font-bold text-foreground">{spouses.length}</Text>
                <Text className="text-[10px] text-muted">{lang === "bm" ? "Pasangan" : "Spouse"}</Text>
              </View>
            )}
            {children.length > 0 && (
              <View className="items-center">
                <Text className="text-lg font-bold text-foreground">{children.length}</Text>
                <Text className="text-[10px] text-muted">{lang === "bm" ? "Anak" : "Children"}</Text>
              </View>
            )}
            {grandchildren.length > 0 && (
              <View className="items-center">
                <Text className="text-lg font-bold text-foreground">{grandchildren.length}</Text>
                <Text className="text-[10px] text-muted">{lang === "bm" ? "Cucu" : "Grandchild"}</Text>
              </View>
            )}
            {greatGrandchildren.length > 0 && (
              <View className="items-center">
                <Text className="text-lg font-bold text-foreground">{greatGrandchildren.length}</Text>
                <Text className="text-[10px] text-muted">{lang === "bm" ? "Cicit" : "Great-GC"}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Quick Actions */}
        <View className="flex-row gap-2 mb-3">
          <Pressable
            onPress={() => router.push({ pathname: "/add-member" as any, params: { parentId: person.id } })}
            style={({ pressed }) => [{ flex: 1, opacity: pressed ? 0.7 : 1 }]}
          >
            <View className="bg-primary/10 rounded-xl py-3 items-center">
              <Text className="text-xs font-medium" style={{ color: colors.primary }}>{t("addChild")}</Text>
            </View>
          </Pressable>
          <Pressable
            onPress={() => router.push({ pathname: "/add-member" as any, params: { spouseId: person.id } })}
            style={({ pressed }) => [{ flex: 1, opacity: pressed ? 0.7 : 1 }]}
          >
            <View className="bg-primary/10 rounded-xl py-3 items-center">
              <Text className="text-xs font-medium" style={{ color: colors.primary }}>{t("addSpouse")}</Text>
            </View>
          </Pressable>
          <Pressable
            onPress={() => router.push({ pathname: "/add-member" as any, params: { childOfId: person.id } })}
            style={({ pressed }) => [{ flex: 1, opacity: pressed ? 0.7 : 1 }]}
          >
            <View className="bg-primary/10 rounded-xl py-3 items-center">
              <Text className="text-xs font-medium" style={{ color: colors.primary }}>{t("addParent")}</Text>
            </View>
          </Pressable>
        </View>

        {/* View as Root */}
        {!isRoot && (
          <Pressable
            onPress={() => {
              setRootPerson(person.id);
              Alert.alert(t("setRoot"), `${person.firstName} ${t("viewAsRootDesc")}`);
            }}
            style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}
          >
            <View className="flex-row items-center justify-center gap-2 rounded-xl py-3 mb-4" style={{ backgroundColor: colors.accent + "15", borderWidth: 1, borderColor: colors.accent + "30" }}>
              <IconSymbol name="tree" size={16} color={colors.accent} />
              <Text className="text-sm font-semibold" style={{ color: colors.accent }}>{t("viewAsRoot")}</Text>
            </View>
          </Pressable>
        )}
        {isRoot && <View className="mb-2" />}

        {/* Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 4, marginBottom: 12 }}>
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <Pressable
                key={tab.key}
                onPress={() => setActiveTab(tab.key)}
                style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
              >
                <View
                  className="rounded-full px-3 py-2 flex-row items-center gap-1"
                  style={{
                    backgroundColor: isActive ? colors.primary : colors.surface,
                    borderWidth: 1,
                    borderColor: isActive ? colors.primary : colors.border,
                  }}
                >
                  <Text
                    className="text-xs font-medium"
                    style={{ color: isActive ? "#fff" : colors.foreground }}
                  >
                    {tab.label}
                  </Text>
                  {tab.count !== undefined && tab.count > 0 && (
                    <View
                      className="rounded-full px-1.5 py-0.5 min-w-[18px] items-center"
                      style={{ backgroundColor: isActive ? "rgba(255,255,255,0.3)" : colors.primary + "20" }}
                    >
                      <Text
                        className="text-[10px] font-bold"
                        style={{ color: isActive ? "#fff" : colors.primary }}
                      >
                        {tab.count}
                      </Text>
                    </View>
                  )}
                </View>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Tab Content */}
        {getTabContent()}
      </ScrollView>
    </ScreenContainer>
  );
}
