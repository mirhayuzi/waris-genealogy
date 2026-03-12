import { Text, View, Pressable, ScrollView, Alert } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useFamily } from "@/lib/family-store";
import { useState } from "react";
import { Gender, Religion, PREFIXES, ETHNICITIES } from "@/lib/types";
import {
  FormLabel, FormInput, ChipSelector,
  DropdownSelector, DatePickerField, PhotoPicker, RelationshipLinkSelector,
} from "@/components/member-form";

export default function AddMemberScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ parentId?: string; spouseId?: string; childOfId?: string }>();
  const colors = useColors();
  const { addPerson, addParentChild, addMarriage, data, setRootPerson } = useFamily();

  const [prefix, setPrefix] = useState("");
  const [firstName, setFirstName] = useState("");
  const [binBinti, setBinBinti] = useState("");
  const [lastName, setLastName] = useState("");
  const [gender, setGender] = useState<Gender>("male");
  const [birthDate, setBirthDate] = useState("");
  const [birthPlace, setBirthPlace] = useState("");
  const [deathDate, setDeathDate] = useState("");
  const [isAlive, setIsAlive] = useState(true);
  const [race, setRace] = useState("");
  const [religion, setReligion] = useState<Religion>("Islam");
  const [bio, setBio] = useState("");
  const [photo, setPhoto] = useState<string | undefined>(undefined);
  const [links, setLinks] = useState<{ type: "spouse" | "parent" | "child"; personId: string }[]>(() => {
    const initial: { type: "spouse" | "parent" | "child"; personId: string }[] = [];
    if (params.parentId) initial.push({ type: "parent", personId: params.parentId });
    if (params.spouseId) initial.push({ type: "spouse", personId: params.spouseId });
    if (params.childOfId) initial.push({ type: "child", personId: params.childOfId });
    return initial;
  });

  const handleSave = () => {
    if (!firstName.trim()) {
      Alert.alert("Required", "Please enter the first name.");
      return;
    }

    const person = addPerson({
      prefix: prefix || undefined,
      firstName: firstName.trim(),
      binBinti: binBinti.trim() || undefined,
      lastName: lastName.trim() || undefined,
      gender,
      birthDate: birthDate.trim() || undefined,
      birthPlace: birthPlace.trim() || undefined,
      deathDate: isAlive ? undefined : (deathDate.trim() || undefined),
      deathPlace: undefined,
      race: race || undefined,
      religion,
      icNumber: undefined,
      photo: photo || undefined,
      bio: bio.trim() || undefined,
      isAlive,
    });

    // Set as root if first person
    if (data.persons.length === 0) {
      setRootPerson(person.id);
    }

    // Process relationship links
    for (const link of links) {
      if (link.type === "parent") {
        addParentChild({ parentId: link.personId, childId: person.id, type: "biological" });
      } else if (link.type === "child") {
        addParentChild({ parentId: person.id, childId: link.personId, type: "biological" });
      } else if (link.type === "spouse") {
        const spousePerson = data.persons.find((p) => p.id === link.personId);
        if (spousePerson) {
          const husbandId = gender === "male" ? person.id : link.personId;
          const wifeId = gender === "female" ? person.id : link.personId;
          addMarriage({ husbandId, wifeId, isActive: true, notes: undefined });
        }
      }
    }

    router.back();
  };

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]} className="px-5 pt-2">
      {/* Header */}
      <View className="flex-row items-center justify-between mb-4">
        <Pressable onPress={() => router.back()} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
          <View className="flex-row items-center gap-1">
            <IconSymbol name="xmark" size={20} color={colors.foreground} />
            <Text className="text-sm text-foreground">Cancel</Text>
          </View>
        </Pressable>
        <Text className="text-lg font-semibold text-foreground">Add Member</Text>
        <Pressable onPress={handleSave} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
          <View className="bg-primary rounded-lg px-4 py-1.5">
            <Text className="text-white text-sm font-semibold">Save</Text>
          </View>
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Photo */}
        <PhotoPicker photo={photo} onPhotoChange={setPhoto} />

        {/* Gender */}
        <FormLabel text="Gender" />
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
                  {g === "male" ? "Male (Lelaki)" : "Female (Perempuan)"}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>

        {/* Prefix - Dropdown */}
        <DropdownSelector
          label="Prefix / Title (Optional)"
          options={PREFIXES}
          selected={prefix}
          onSelect={setPrefix}
          placeholder="Select prefix..."
        />

        {/* Name */}
        <FormLabel text="First Name *" />
        <FormInput value={firstName} onChangeText={setFirstName} placeholder="e.g. Ahmad, Siti, Wei Liang" />

        <FormLabel text={`${gender === "male" ? "Bin" : "Binti"} (Father's Name)`} />
        <FormInput value={binBinti} onChangeText={setBinBinti} placeholder="e.g. Yusof, Abdullah" />

        <FormLabel text="Last Name / Clan Name (Optional)" />
        <FormInput value={lastName} onChangeText={setLastName} placeholder="e.g. Al-Attas, Tan, Krishnan" />

        {/* Dates - Calendar Picker */}
        <DatePickerField label="Date of Birth" value={birthDate} onChange={setBirthDate} />

        <FormLabel text="Place of Birth" />
        <FormInput value={birthPlace} onChangeText={setBirthPlace} placeholder="e.g. Kota Bharu, Kelantan" />

        {/* Alive/Deceased */}
        <FormLabel text="Status" />
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
                  {alive ? "Living (Hidup)" : "Deceased (Meninggal)"}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>

        {!isAlive && (
          <DatePickerField label="Date of Death" value={deathDate} onChange={setDeathDate} />
        )}

        {/* Ethnicity */}
        <FormLabel text="Ethnicity" />
        <ChipSelector options={ETHNICITIES} selected={race} onSelect={(v) => setRace(v === race ? "" : v)} />

        {/* Religion */}
        <FormLabel text="Religion" />
        <ChipSelector
          options={["Islam", "Buddhism", "Hinduism", "Christianity", "Sikhism", "Others"] as const}
          selected={religion}
          onSelect={(v) => setReligion(v as Religion)}
        />

        {/* Relationship Links */}
        <RelationshipLinkSelector
          persons={data.persons}
          selectedLinks={links}
          onLinksChange={setLinks}
        />

        {/* Bio */}
        <FormLabel text="Notes / Biography (Optional)" />
        <FormInput value={bio} onChangeText={setBio} placeholder="Short biography or notes..." multiline />
      </ScrollView>
    </ScreenContainer>
  );
}
