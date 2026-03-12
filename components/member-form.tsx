import { Text, View, Pressable, ScrollView, TextInput, Modal, FlatList, Platform, Alert } from "react-native";
import { Image } from "expo-image";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Gender, Religion, PREFIXES, ETHNICITIES, Person, getDisplayName } from "@/lib/types";
import { useState, useCallback } from "react";
import * as ImagePicker from "expo-image-picker";

// ---- Shared Form Components ----

export function FormLabel({ text }: { text: string }) {
  return <Text className="text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">{text}</Text>;
}

export function FormInput({ value, onChangeText, placeholder, multiline, editable }: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  multiline?: boolean;
  editable?: boolean;
}) {
  const colors = useColors();
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.muted}
      editable={editable}
      className="bg-surface border border-border rounded-xl px-4 py-3 text-sm text-foreground mb-4"
      style={{ color: colors.foreground, minHeight: multiline ? 80 : undefined }}
      multiline={multiline}
      textAlignVertical={multiline ? "top" : "center"}
    />
  );
}

export function ChipSelector({ options, selected, onSelect }: {
  options: readonly string[];
  selected: string;
  onSelect: (v: string) => void;
}) {
  const colors = useColors();
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

// ---- Dropdown Selector ----

export function DropdownSelector({ label, options, selected, onSelect, placeholder }: {
  label: string;
  options: readonly string[];
  selected: string;
  onSelect: (v: string) => void;
  placeholder: string;
}) {
  const colors = useColors();
  const [visible, setVisible] = useState(false);

  return (
    <>
      <FormLabel text={label} />
      <Pressable onPress={() => setVisible(true)} style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}>
        <View className="bg-surface border border-border rounded-xl px-4 py-3 mb-4 flex-row items-center justify-between">
          <Text className="text-sm" style={{ color: selected ? colors.foreground : colors.muted }}>
            {selected || placeholder}
          </Text>
          <IconSymbol name="chevron.right" size={14} color={colors.muted} />
        </View>
      </Pressable>

      <Modal visible={visible} transparent animationType="slide">
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }}
          onPress={() => setVisible(false)}
        >
          <Pressable style={{ maxHeight: "60%" }}>
            <View className="bg-background rounded-t-3xl" style={{ paddingBottom: Platform.OS === "ios" ? 34 : 20 }}>
              <View className="items-center py-3">
                <View className="w-10 h-1 rounded-full bg-border" />
              </View>
              <Text className="text-base font-semibold text-foreground px-5 mb-3">{label}</Text>

              {/* None / Clear option */}
              <Pressable
                onPress={() => { onSelect(""); setVisible(false); }}
                style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
              >
                <View className="px-5 py-3 flex-row items-center justify-between border-b border-border">
                  <Text className="text-sm text-muted italic">None</Text>
                  {!selected && <IconSymbol name="checkmark" size={16} color={colors.primary} />}
                </View>
              </Pressable>

              <FlatList
                data={options}
                keyExtractor={(item) => item}
                renderItem={({ item }) => (
                  <Pressable
                    onPress={() => { onSelect(item); setVisible(false); }}
                    style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
                  >
                    <View className="px-5 py-3 flex-row items-center justify-between border-b border-border">
                      <Text className="text-sm text-foreground">{item}</Text>
                      {selected === item && <IconSymbol name="checkmark" size={16} color={colors.primary} />}
                    </View>
                  </Pressable>
                )}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

// ---- Date Picker ----

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function DatePickerField({ label, value, onChange }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const colors = useColors();
  const [visible, setVisible] = useState(false);

  // Parse existing value
  const parsed = value ? parseDateString(value) : null;
  const [selYear, setSelYear] = useState(parsed?.year || new Date().getFullYear());
  const [selMonth, setSelMonth] = useState(parsed?.month || 1);
  const [selDay, setSelDay] = useState(parsed?.day || 1);

  const years: number[] = [];
  for (let y = new Date().getFullYear(); y >= 1900; y--) years.push(y);

  const daysInMonth = new Date(selYear, selMonth, 0).getDate();
  const days: number[] = [];
  for (let d = 1; d <= daysInMonth; d++) days.push(d);

  const handleConfirm = () => {
    const mm = String(selMonth).padStart(2, "0");
    const dd = String(Math.min(selDay, daysInMonth)).padStart(2, "0");
    onChange(`${selYear}-${mm}-${dd}`);
    setVisible(false);
  };

  const handleClear = () => {
    onChange("");
    setVisible(false);
  };

  return (
    <>
      <FormLabel text={label} />
      <Pressable onPress={() => setVisible(true)} style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}>
        <View className="bg-surface border border-border rounded-xl px-4 py-3 mb-4 flex-row items-center justify-between">
          <Text className="text-sm" style={{ color: value ? colors.foreground : colors.muted }}>
            {value || "Tap to select date"}
          </Text>
          <IconSymbol name="calendar" size={16} color={colors.muted} />
        </View>
      </Pressable>

      <Modal visible={visible} transparent animationType="slide">
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }}
          onPress={() => setVisible(false)}
        >
          <Pressable>
            <View className="bg-background rounded-t-3xl pb-8">
              <View className="items-center py-3">
                <View className="w-10 h-1 rounded-full bg-border" />
              </View>
              <Text className="text-base font-semibold text-foreground px-5 mb-4">{label}</Text>

              {/* Year / Month / Day selectors */}
              <View className="flex-row px-5 gap-2 mb-4">
                {/* Day */}
                <View className="flex-1">
                  <Text className="text-xs text-muted mb-1 text-center">Day</Text>
                  <ScrollView style={{ height: 150 }} showsVerticalScrollIndicator={false}>
                    {days.map((d) => (
                      <Pressable key={d} onPress={() => setSelDay(d)}>
                        <View
                          className="py-2 rounded-lg items-center"
                          style={{ backgroundColor: selDay === d ? colors.primary + "20" : "transparent" }}
                        >
                          <Text className="text-sm font-medium" style={{ color: selDay === d ? colors.primary : colors.foreground }}>
                            {d}
                          </Text>
                        </View>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>

                {/* Month */}
                <View className="flex-[2]">
                  <Text className="text-xs text-muted mb-1 text-center">Month</Text>
                  <ScrollView style={{ height: 150 }} showsVerticalScrollIndicator={false}>
                    {MONTHS.map((m, idx) => (
                      <Pressable key={m} onPress={() => setSelMonth(idx + 1)}>
                        <View
                          className="py-2 rounded-lg items-center"
                          style={{ backgroundColor: selMonth === idx + 1 ? colors.primary + "20" : "transparent" }}
                        >
                          <Text className="text-sm font-medium" style={{ color: selMonth === idx + 1 ? colors.primary : colors.foreground }}>
                            {m}
                          </Text>
                        </View>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>

                {/* Year */}
                <View className="flex-1">
                  <Text className="text-xs text-muted mb-1 text-center">Year</Text>
                  <ScrollView style={{ height: 150 }} showsVerticalScrollIndicator={false}>
                    {years.map((y) => (
                      <Pressable key={y} onPress={() => setSelYear(y)}>
                        <View
                          className="py-2 rounded-lg items-center"
                          style={{ backgroundColor: selYear === y ? colors.primary + "20" : "transparent" }}
                        >
                          <Text className="text-sm font-medium" style={{ color: selYear === y ? colors.primary : colors.foreground }}>
                            {y}
                          </Text>
                        </View>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              </View>

              {/* Buttons */}
              <View className="flex-row px-5 gap-3">
                <Pressable onPress={handleClear} style={({ pressed }) => [{ flex: 1, opacity: pressed ? 0.8 : 1 }]}>
                  <View className="py-3 rounded-xl border border-border items-center">
                    <Text className="text-sm font-medium text-muted">Clear</Text>
                  </View>
                </Pressable>
                <Pressable onPress={handleConfirm} style={({ pressed }) => [{ flex: 2, opacity: pressed ? 0.8 : 1 }]}>
                  <View className="py-3 rounded-xl bg-primary items-center">
                    <Text className="text-sm font-semibold text-white">Confirm</Text>
                  </View>
                </Pressable>
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function parseDateString(s: string): { year: number; month: number; day: number } | null {
  const parts = s.split("-");
  if (parts.length === 3) {
    return { year: parseInt(parts[0], 10), month: parseInt(parts[1], 10), day: parseInt(parts[2], 10) };
  }
  return null;
}

// ---- Photo Picker ----

export function PhotoPicker({ photo, onPhotoChange }: {
  photo: string | undefined;
  onPhotoChange: (uri: string | undefined) => void;
}) {
  const colors = useColors();
  const [showOptions, setShowOptions] = useState(false);

  const pickFromGallery = async () => {
    setShowOptions(false);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        onPhotoChange(result.assets[0].uri);
      }
    } catch (e) {
      Alert.alert("Error", "Failed to pick image from gallery.");
    }
  };

  const takePhoto = async () => {
    setShowOptions(false);
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Required", "Camera permission is needed to take photos.");
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        onPhotoChange(result.assets[0].uri);
      }
    } catch (e) {
      Alert.alert("Error", "Failed to take photo.");
    }
  };

  const removePhoto = () => {
    setShowOptions(false);
    onPhotoChange(undefined);
  };

  return (
    <>
      <FormLabel text="Photo (Optional)" />
      <View className="items-center mb-4">
        <Pressable onPress={() => setShowOptions(true)} style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}>
          {photo ? (
            <View style={{ position: "relative" }}>
              <Image
                source={{ uri: photo }}
                style={{ width: 96, height: 96, borderRadius: 48, borderWidth: 3, borderColor: colors.primary }}
                contentFit="cover"
              />
              <View
                style={{
                  position: "absolute", bottom: 0, right: 0,
                  width: 30, height: 30, borderRadius: 15,
                  backgroundColor: colors.primary,
                  alignItems: "center", justifyContent: "center",
                  borderWidth: 2, borderColor: colors.background,
                }}
              >
                <IconSymbol name="camera.fill" size={13} color="#fff" />
              </View>
            </View>
          ) : (
            <View
              style={{
                width: 96, height: 96, borderRadius: 48,
                backgroundColor: colors.primary + "15",
                borderWidth: 2, borderColor: colors.primary + "40",
                borderStyle: "dashed",
                alignItems: "center", justifyContent: "center",
              }}
            >
              <IconSymbol name="camera.fill" size={24} color={colors.primary} />
              <Text style={{ fontSize: 10, color: colors.muted, marginTop: 4 }}>Add Photo</Text>
            </View>
          )}
        </Pressable>
      </View>

      <Modal visible={showOptions} transparent animationType="fade">
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }}
          onPress={() => setShowOptions(false)}
        >
          <Pressable>
            <View className="bg-background rounded-t-3xl pb-8">
              <View className="items-center py-3">
                <View className="w-10 h-1 rounded-full bg-border" />
              </View>
              <Text className="text-base font-semibold text-foreground px-5 mb-3">Choose Photo</Text>

              <Pressable onPress={takePhoto} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
                <View className="flex-row items-center px-5 py-3.5 gap-3">
                  <IconSymbol name="camera.fill" size={20} color={colors.primary} />
                  <Text className="text-sm text-foreground">Take Photo</Text>
                </View>
              </Pressable>

              <Pressable onPress={pickFromGallery} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
                <View className="flex-row items-center px-5 py-3.5 gap-3">
                  <IconSymbol name="photo.fill" size={20} color={colors.primary} />
                  <Text className="text-sm text-foreground">Choose from Gallery</Text>
                </View>
              </Pressable>

              {photo && (
                <Pressable onPress={removePhoto} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
                  <View className="flex-row items-center px-5 py-3.5 gap-3">
                    <IconSymbol name="xmark" size={20} color={colors.error} />
                    <Text className="text-sm" style={{ color: colors.error }}>Remove Photo</Text>
                  </View>
                </Pressable>
              )}

              <Pressable onPress={() => setShowOptions(false)} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
                <View className="mx-5 mt-2 py-3 rounded-xl border border-border items-center">
                  <Text className="text-sm font-medium text-muted">Cancel</Text>
                </View>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

// ---- Relationship Link Selector ----

export function RelationshipLinkSelector({ persons, currentPersonId, selectedLinks, onLinksChange }: {
  persons: Person[];
  currentPersonId?: string;
  selectedLinks: { type: "spouse" | "parent" | "child"; personId: string }[];
  onLinksChange: (links: { type: "spouse" | "parent" | "child"; personId: string }[]) => void;
}) {
  const colors = useColors();
  const [showPicker, setShowPicker] = useState(false);
  const [linkType, setLinkType] = useState<"spouse" | "parent" | "child">("spouse");

  const availablePersons = persons.filter((p) => {
    if (currentPersonId && p.id === currentPersonId) return false;
    return !selectedLinks.some((l) => l.personId === p.id);
  });

  const addLink = (personId: string) => {
    onLinksChange([...selectedLinks, { type: linkType, personId }]);
    setShowPicker(false);
  };

  const removeLink = (personId: string) => {
    onLinksChange(selectedLinks.filter((l) => l.personId !== personId));
  };

  const getPersonName = (id: string) => {
    const p = persons.find((pp) => pp.id === id);
    return p ? getDisplayName(p) : "Unknown";
  };

  const linkTypeLabel = (t: string) => {
    switch (t) {
      case "spouse": return "Spouse";
      case "parent": return "Parent";
      case "child": return "Child";
      default: return t;
    }
  };

  const linkTypeColor = (t: string) => {
    switch (t) {
      case "spouse": return colors.accent;
      case "parent": return colors.primary;
      case "child": return colors.success;
      default: return colors.muted;
    }
  };

  if (persons.length === 0) return null;

  return (
    <>
      <FormLabel text="Family Connections" />
      <View className="bg-surface rounded-2xl border border-border p-3 mb-4">
        {/* Existing links */}
        {selectedLinks.map((link) => (
          <View key={`${link.type}-${link.personId}`} className="flex-row items-center justify-between py-2 border-b border-border">
            <View className="flex-row items-center gap-2 flex-1">
              <View className="px-2 py-0.5 rounded-full" style={{ backgroundColor: linkTypeColor(link.type) + "20" }}>
                <Text className="text-[10px] font-semibold" style={{ color: linkTypeColor(link.type) }}>
                  {linkTypeLabel(link.type).toUpperCase()}
                </Text>
              </View>
              <Text className="text-sm text-foreground flex-1" numberOfLines={1}>{getPersonName(link.personId)}</Text>
            </View>
            <Pressable onPress={() => removeLink(link.personId)} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
              <View className="w-6 h-6 rounded-full bg-error/10 items-center justify-center">
                <IconSymbol name="xmark" size={10} color={colors.error} />
              </View>
            </Pressable>
          </View>
        ))}

        {/* Add link button */}
        <View className="flex-row gap-2 mt-2">
          {(["spouse", "parent", "child"] as const).map((t) => (
            <Pressable
              key={t}
              onPress={() => { setLinkType(t); setShowPicker(true); }}
              style={({ pressed }) => [{ flex: 1, opacity: pressed ? 0.8 : 1 }]}
            >
              <View className="py-2 rounded-lg border items-center" style={{ borderColor: linkTypeColor(t) + "40" }}>
                <Text className="text-[10px] font-semibold" style={{ color: linkTypeColor(t) }}>
                  + {linkTypeLabel(t)}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Person picker modal */}
      <Modal visible={showPicker} transparent animationType="slide">
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }}
          onPress={() => setShowPicker(false)}
        >
          <Pressable style={{ maxHeight: "60%" }}>
            <View className="bg-background rounded-t-3xl" style={{ paddingBottom: Platform.OS === "ios" ? 34 : 20 }}>
              <View className="items-center py-3">
                <View className="w-10 h-1 rounded-full bg-border" />
              </View>
              <Text className="text-base font-semibold text-foreground px-5 mb-1">
                Select {linkTypeLabel(linkType)}
              </Text>
              <Text className="text-xs text-muted px-5 mb-3">
                Choose a family member to link as {linkTypeLabel(linkType).toLowerCase()}
              </Text>

              {availablePersons.length === 0 ? (
                <View className="px-5 py-6 items-center">
                  <Text className="text-sm text-muted">No available members to link.</Text>
                </View>
              ) : (
                <FlatList
                  data={availablePersons}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item }) => (
                    <Pressable
                      onPress={() => addLink(item.id)}
                      style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
                    >
                      <View className="flex-row items-center px-5 py-3 gap-3 border-b border-border">
                        <View
                          className="w-8 h-8 rounded-full items-center justify-center"
                          style={{ backgroundColor: colors.primary + "15" }}
                        >
                          <Text className="text-xs font-bold" style={{ color: colors.primary }}>
                            {item.firstName.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <View className="flex-1">
                          <Text className="text-sm font-medium text-foreground">{getDisplayName(item)}</Text>
                          <Text className="text-xs text-muted">
                            {item.gender === "male" ? "Male" : "Female"} · {item.religion}
                          </Text>
                        </View>
                      </View>
                    </Pressable>
                  )}
                />
              )}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
