import { View, Text } from "react-native";
import { Image } from "expo-image";
import { Person } from "@/lib/types";
import { useColors } from "@/hooks/use-colors";

interface MemberAvatarProps {
  person: Person;
  size: number;
}

export function MemberAvatar({ person, size }: MemberAvatarProps) {
  const colors = useColors();

  if (person.photo) {
    return (
      <Image
        source={{ uri: person.photo }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        contentFit="cover"
      />
    );
  }

  const bgColor = person.isAlive ? colors.primary + "20" : colors.muted + "20";
  const textColor = person.isAlive ? colors.primary : colors.muted;

  return (
    <View
      className="items-center justify-center"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: bgColor,
      }}
    >
      <Text
        className="font-bold"
        style={{ color: textColor, fontSize: size * 0.4 }}
      >
        {person.firstName.charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}
