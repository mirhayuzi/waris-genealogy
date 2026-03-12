import { Text, View, Pressable, ScrollView, TextInput, Alert } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useFamily } from "@/lib/family-store";
import { useState } from "react";
import { Gender, Religion, PREFIXES, ETHNICITIES } from "@/lib/types";

function FormLabel({ text }: { text: string }) {
  return <Text className="text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">{text}</Text>;
}

function FormInput({ value, onChangeText, placeholder, multiline }: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  multiline?: boolean;
}) {
  const colors = useColors();
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.muted}
      className="bg-surface border border-border rounded-xl px-4 py-3 text-sm text-foreground mb-4"
      style={{ color: colors.foreground, minHeight: multiline ? 80 : undefined }}
      multiline={multiline}
      textAlignVertical={multiline ? "top" : "center"}
    />
  );
}

function ChipSelector({ options, selected, onSelect, colors }: {
  options: readonly string[];
  selected: string;
  onSelect: (v: string) => void;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View className="flex-row flex-wrap gap-2 mb-4">
      {options.map((opt) => (
        <Pressable key={opt} onPress={() => onSelect(opt)} style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}>
          <View
            className="px-3 py-1.5 rounded-full border"
            style={{
              backgroundColor: selected === opt ? colors.primary : "transparent",
              borderColor: selected === opt ? colors.primary : colors.border,
            }}
          >
            <Text
              className="text-xs font-medium"
              style={{ color: selected === opt ? "#fff" : colors.foreground }}
            >
              {opt}
            </Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

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
      photo: undefined,
      bio: bio.trim() || undefined,
      isAlive,
    });

    // Set as root if first person
    if (data.persons.length === 0) {
      setRootPerson(person.id);
    }

    // Link relationships if params provided
    if (params.parentId) {
      addParentChild({ parentId: params.parentId, childId: person.id, type: "biological" });
    }
    if (params.childOfId) {
      addParentChild({ parentId: person.id, childId: params.childOfId, type: "biological" });
    }
    if (params.spouseId) {
      const spousePerson = data.persons.find((p) => p.id === params.spouseId);
      if (spousePerson) {
        const husbandId = gender === "male" ? person.id : params.spouseId;
        const wifeId = gender === "female" ? person.id : params.spouseId;
        addMarriage({ husbandId, wifeId, isActive: true, notes: undefined });
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

        {/* Prefix */}
        <FormLabel text="Prefix / Title (Optional)" />
        <ChipSelector options={PREFIXES} selected={prefix} onSelect={(v) => setPrefix(v === prefix ? "" : v)} colors={colors} />

        {/* Name */}
        <FormLabel text="First Name *" />
        <FormInput value={firstName} onChangeText={setFirstName} placeholder="e.g. Ahmad, Siti, Wei Liang" />

        <FormLabel text={`${gender === "male" ? "Bin" : "Binti"} (Father's Name)`} />
        <FormInput value={binBinti} onChangeText={setBinBinti} placeholder="e.g. Yusof, Abdullah" />

        <FormLabel text="Last Name / Clan Name (Optional)" />
        <FormInput value={lastName} onChangeText={setLastName} placeholder="e.g. Al-Attas, Tan, Krishnan" />

        {/* Dates */}
        <FormLabel text="Date of Birth" />
        <FormInput value={birthDate} onChangeText={setBirthDate} placeholder="e.g. 1965-03-15 or 15 Mac 1965" />

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
          <>
            <FormLabel text="Date of Death" />
            <FormInput value={deathDate} onChangeText={setDeathDate} placeholder="e.g. 2020-01-10" />
          </>
        )}

        {/* Ethnicity */}
        <FormLabel text="Ethnicity" />
        <ChipSelector options={ETHNICITIES} selected={race} onSelect={(v) => setRace(v === race ? "" : v)} colors={colors} />

        {/* Religion */}
        <FormLabel text="Religion" />
        <ChipSelector
          options={["Islam", "Buddhism", "Hinduism", "Christianity", "Sikhism", "Others"] as const}
          selected={religion}
          onSelect={(v) => setReligion(v as Religion)}
          colors={colors}
        />

        {/* Bio */}
        <FormLabel text="Notes / Biography (Optional)" />
        <FormInput value={bio} onChangeText={setBio} placeholder="Short biography or notes..." multiline />
      </ScrollView>
    </ScreenContainer>
  );
}
