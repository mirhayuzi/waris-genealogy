import { Text, View, Pressable, ScrollView, TextInput, Alert } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useFamily } from "@/lib/family-store";
import { useState, useEffect } from "react";
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
            <Text className="text-xs font-medium" style={{ color: selected === opt ? "#fff" : colors.foreground }}>
              {opt}
            </Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

export default function EditMemberScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const { getPersonById, updatePerson } = useFamily();

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

  const handleSave = () => {
    if (!firstName.trim()) {
      Alert.alert("Required", "Please enter the first name.");
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
      isAlive,
    });
    router.back();
  };

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]} className="px-5 pt-2">
      <View className="flex-row items-center justify-between mb-4">
        <Pressable onPress={() => router.back()} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
          <View className="flex-row items-center gap-1">
            <IconSymbol name="xmark" size={20} color={colors.foreground} />
            <Text className="text-sm text-foreground">Cancel</Text>
          </View>
        </Pressable>
        <Text className="text-lg font-semibold text-foreground">Edit Member</Text>
        <Pressable onPress={handleSave} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
          <View className="bg-primary rounded-lg px-4 py-1.5">
            <Text className="text-white text-sm font-semibold">Save</Text>
          </View>
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
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

        <FormLabel text="Prefix / Title (Optional)" />
        <ChipSelector options={PREFIXES} selected={prefix} onSelect={(v) => setPrefix(v === prefix ? "" : v)} colors={colors} />

        <FormLabel text="First Name *" />
        <FormInput value={firstName} onChangeText={setFirstName} placeholder="e.g. Ahmad, Siti" />

        <FormLabel text={`${gender === "male" ? "Bin" : "Binti"} (Father's Name)`} />
        <FormInput value={binBinti} onChangeText={setBinBinti} placeholder="e.g. Yusof" />

        <FormLabel text="Last Name / Clan Name (Optional)" />
        <FormInput value={lastName} onChangeText={setLastName} placeholder="e.g. Al-Attas" />

        <FormLabel text="Date of Birth" />
        <FormInput value={birthDate} onChangeText={setBirthDate} placeholder="e.g. 1965-03-15" />

        <FormLabel text="Place of Birth" />
        <FormInput value={birthPlace} onChangeText={setBirthPlace} placeholder="e.g. Kota Bharu" />

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
                  {alive ? "Living" : "Deceased"}
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

        <FormLabel text="Ethnicity" />
        <ChipSelector options={ETHNICITIES} selected={race} onSelect={(v) => setRace(v === race ? "" : v)} colors={colors} />

        <FormLabel text="Religion" />
        <ChipSelector
          options={["Islam", "Buddhism", "Hinduism", "Christianity", "Sikhism", "Others"] as const}
          selected={religion}
          onSelect={(v) => setReligion(v as Religion)}
          colors={colors}
        />

        <FormLabel text="Notes / Biography (Optional)" />
        <FormInput value={bio} onChangeText={setBio} placeholder="Short biography..." multiline />
      </ScrollView>
    </ScreenContainer>
  );
}
