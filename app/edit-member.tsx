import { Text, View, Pressable, ScrollView, Alert } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useFamily } from "@/lib/family-store";
import { useState, useMemo } from "react";
import { useI18n } from "@/lib/i18n";
import { Gender, Religion, PREFIXES, ETHNICITIES, getDisplayName } from "@/lib/types";
import {
  FormLabel, FormInput, ChipSelector,
  DropdownSelector, DatePickerField, PhotoPicker, RelationshipLinkSelector,
} from "@/components/member-form";

export default function EditMemberScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const { t } = useI18n();
  const { getPersonById, updatePerson, data, addParentChild, addMarriage, deleteParentChild, deleteMarriage } = useFamily();

  const person = getPersonById(id || "");

  const [prefix, setPrefix] = useState(person?.prefix || "");
  const [firstName, setFirstName] = useState(person?.firstName || "");
  const [binBinti, setBinBinti] = useState(person?.binBinti || "");
  const [lastName, setLastName] = useState(person?.lastName || "");
  const [gender, setGender] = useState<Gender>(person?.gender || "male");
  const [birthDate, setBirthDate] = useState(person?.birthDate || "");
  const [birthPlace, setBirthPlace] = useState(person?.birthPlace || "");
  const [deathDate, setDeathDate] = useState(person?.deathDate || "");
  const [isAlive, setIsAlive] = useState(person?.isAlive ?? true);
  const [race, setRace] = useState(person?.race || "");
  const [religion, setReligion] = useState<Religion>(person?.religion || "Islam");
  const [bio, setBio] = useState(person?.bio || "");
  const [photo, setPhoto] = useState<string | undefined>(person?.photo);

  // Build existing relationship links from data
  const existingLinks = useMemo(() => {
    if (!id) return [];
    const links: { type: "spouse" | "parent" | "child"; personId: string }[] = [];

    // Parents of this person
    data.parentChildren
      .filter((pc) => pc.childId === id)
      .forEach((pc) => links.push({ type: "parent", personId: pc.parentId }));

    // Children of this person
    data.parentChildren
      .filter((pc) => pc.parentId === id)
      .forEach((pc) => links.push({ type: "child", personId: pc.childId }));

    // Spouses of this person
    data.marriages
      .filter((m) => m.husbandId === id || m.wifeId === id)
      .forEach((m) => {
        const spouseId = m.husbandId === id ? m.wifeId : m.husbandId;
        links.push({ type: "spouse", personId: spouseId });
      });

    return links;
  }, [id, data.parentChildren, data.marriages]);

  const [links, setLinks] = useState(existingLinks);

  if (!person) {
    return (
      <ScreenContainer className="items-center justify-center">
        <Text className="text-foreground">{t("personNotFound")}</Text>
        <Pressable onPress={() => router.back()} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
          <Text className="text-primary mt-4">{t("back")}</Text>
        </Pressable>
      </ScreenContainer>
    );
  }

  const handleSave = () => {
    if (!firstName.trim()) {
      Alert.alert(t("required"), t("firstNameRequired"));
      return;
    }

    updatePerson({
      ...person,
      prefix: prefix || undefined,
      firstName: firstName.trim(),
      binBinti: binBinti.trim() || undefined,
      lastName: lastName.trim() || undefined,
      gender,
      birthDate: birthDate.trim() || undefined,
      birthPlace: birthPlace.trim() || undefined,
      deathDate: isAlive ? undefined : (deathDate.trim() || undefined),
      race: race || undefined,
      religion,
      bio: bio.trim() || undefined,
      photo: photo || undefined,
      isAlive,
    });

    // Sync relationship links: remove old, add new
    // Remove old parent-child where this person is child
    data.parentChildren
      .filter((pc) => pc.childId === id)
      .forEach((pc) => {
        if (!links.some((l) => l.type === "parent" && l.personId === pc.parentId)) {
          deleteParentChild(pc.id);
        }
      });
    // Remove old parent-child where this person is parent
    data.parentChildren
      .filter((pc) => pc.parentId === id)
      .forEach((pc) => {
        if (!links.some((l) => l.type === "child" && l.personId === pc.childId)) {
          deleteParentChild(pc.id);
        }
      });
    // Remove old marriages
    data.marriages
      .filter((m) => m.husbandId === id || m.wifeId === id)
      .forEach((m) => {
        const spouseId = m.husbandId === id ? m.wifeId : m.husbandId;
        if (!links.some((l) => l.type === "spouse" && l.personId === spouseId)) {
          deleteMarriage(m.id);
        }
      });

    // Add new links
    for (const link of links) {
      if (link.type === "parent") {
        const exists = data.parentChildren.some((pc) => pc.parentId === link.personId && pc.childId === id);
        if (!exists) addParentChild({ parentId: link.personId, childId: id!, type: "biological" });
      } else if (link.type === "child") {
        const exists = data.parentChildren.some((pc) => pc.parentId === id && pc.childId === link.personId);
        if (!exists) addParentChild({ parentId: id!, childId: link.personId, type: "biological" });
      } else if (link.type === "spouse") {
        const exists = data.marriages.some(
          (m) => (m.husbandId === id && m.wifeId === link.personId) || (m.wifeId === id && m.husbandId === link.personId)
        );
        if (!exists) {
          const husbandId = gender === "male" ? id! : link.personId;
          const wifeId = gender === "female" ? id! : link.personId;
          addMarriage({ husbandId, wifeId, isActive: true, notes: undefined });
        }
      }
    }

    router.back();
  };

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]} className="px-5 pt-2">
      <View className="flex-row items-center justify-between mb-4">
        <Pressable onPress={() => router.back()} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
          <View className="flex-row items-center gap-1">
            <IconSymbol name="xmark" size={20} color={colors.foreground} />
            <Text className="text-sm text-foreground">{t("cancel")}</Text>
          </View>
        </Pressable>
        <Text className="text-lg font-semibold text-foreground">{t("editMember")}</Text>
        <Pressable onPress={handleSave} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
          <View className="bg-primary rounded-lg px-4 py-1.5">
            <Text className="text-white text-sm font-semibold">{t("save")}</Text>
          </View>
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Photo */}
        <PhotoPicker photo={photo} onPhotoChange={setPhoto} />

        {/* Gender */}
        <FormLabel text={t("gender")} />
        <View className="flex-row gap-3 mb-4">
          {(["male", "female"] as Gender[]).map((g) => (
            <Pressable key={g} onPress={() => setGender(g)} style={({ pressed }) => [{ flex: 1, opacity: pressed ? 0.8 : 1 }]}>
              <View
                className="py-3 rounded-xl border items-center"
                style={{
                  backgroundColor: gender === g ? colors.primary : "transparent",
                  borderColor: gender === g ? colors.primary : colors.border,
                }}
              >
                <Text className="text-sm font-medium" style={{ color: gender === g ? "#fff" : colors.foreground }}>
                  {g === "male" ? t("male") : t("female")}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>

        {/* Prefix - Dropdown */}
        <DropdownSelector
          label={t("prefixTitle")}
          options={PREFIXES}
          selected={prefix}
          onSelect={setPrefix}
          placeholder={t("selectPrefix")}
        />

        {/* Name */}
        <FormLabel text={t("firstName")} />
        <FormInput value={firstName} onChangeText={setFirstName} placeholder={t("firstNamePlaceholder")} />

        <FormLabel text={`${gender === "male" ? t("bin") : t("binti")} ${t("fatherName")}`} />
        <FormInput value={binBinti} onChangeText={setBinBinti} placeholder={t("fatherNamePlaceholder")} />

        <FormLabel text={t("lastName")} />
        <FormInput value={lastName} onChangeText={setLastName} placeholder={t("lastNamePlaceholder")} />

        {/* Dates - Calendar Picker */}
        <DatePickerField label={t("dateOfBirth")} value={birthDate} onChange={setBirthDate} />

        <FormLabel text={t("placeOfBirth")} />
        <FormInput value={birthPlace} onChangeText={setBirthPlace} placeholder={t("placeOfBirthPlaceholder")} />

        {/* Alive/Deceased */}
        <FormLabel text={t("status")} />
        <View className="flex-row gap-3 mb-4">
          {[true, false].map((alive) => (
            <Pressable key={String(alive)} onPress={() => setIsAlive(alive)} style={({ pressed }) => [{ flex: 1, opacity: pressed ? 0.8 : 1 }]}>
              <View
                className="py-3 rounded-xl border items-center"
                style={{
                  backgroundColor: isAlive === alive ? (alive ? colors.success : colors.muted) : "transparent",
                  borderColor: isAlive === alive ? (alive ? colors.success : colors.muted) : colors.border,
                }}
              >
                <Text className="text-sm font-medium" style={{ color: isAlive === alive ? "#fff" : colors.foreground }}>
                  {alive ? t("livingStatus") : t("deceasedStatus")}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>

        {!isAlive && (
          <DatePickerField label={t("dateOfDeath")} value={deathDate} onChange={setDeathDate} />
        )}

        {/* Ethnicity */}
        <FormLabel text={t("ethnicity")} />
        <ChipSelector options={ETHNICITIES} selected={race} onSelect={(v) => setRace(v === race ? "" : v)} t_key="ethnicity" />

        {/* Religion */}
        <FormLabel text={t("religion")} />
        <ChipSelector
          options={["Islam", "Buddhism", "Hinduism", "Christianity", "Sikhism", "Others"] as const}
          selected={religion}
          onSelect={(v) => setReligion(v as Religion)}
          t_key="religion"
        />

        {/* Relationship Links */}
        <RelationshipLinkSelector
          persons={data.persons}
          currentPersonId={id}
          selectedLinks={links}
          onLinksChange={setLinks}
        />

        {/* Bio */}
        <FormLabel text={t("notes")} />
        <FormInput value={bio} onChangeText={setBio} placeholder={t("notesPlaceholder")} multiline />
      </ScrollView>
    </ScreenContainer>
  );
}
