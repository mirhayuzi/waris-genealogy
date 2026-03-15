import { View, Pressable, Text } from "react-native";
import { useRouter, usePathname } from "expo-router";
import { IconSymbol } from "./ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Persistent Bottom Navigation Bar
 * Visible on all screens, always accessible
 */
export function PersistentNav() {
  const router = useRouter();
  const pathname = usePathname();
  const colors = useColors();
  const { t } = useI18n();

  const tabs = [
    { name: "home", label: t("nav.home"), icon: "house.fill", route: "/" },
    { name: "tree", label: t("nav.tree"), icon: "tree.fill", route: "/tree" },
    { name: "tools", label: t("nav.tools"), icon: "wrench.fill", route: "/tools" },
    { name: "settings", label: t("nav.settings"), icon: "gear.fill", route: "/settings" },
  ];

  const isActive = (route: string) => {
    return pathname === route || pathname.startsWith(route + "/");
  };

  return (
    <View
      className="border-t border-border bg-background"
      style={{
        paddingBottom: 8,
        paddingTop: 8,
        flexDirection: "row",
        justifyContent: "space-around",
        alignItems: "center",
      }}
    >
      {tabs.map((tab) => (
        <Pressable
          key={tab.name}
          onPress={() => router.push(tab.route as any)}
          className={cn(
            "flex-1 items-center justify-center py-2 px-2 rounded-lg",
            isActive(tab.route) ? "bg-primary/10" : ""
          )}
          style={({ pressed }) => ({
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <IconSymbol
            name={tab.icon as any}
            size={24}
            color={isActive(tab.route) ? colors.primary : colors.muted}
          />
          <Text
            className={cn(
              "text-xs mt-1 text-center",
              isActive(tab.route) ? "text-primary font-semibold" : "text-muted"
            )}
          >
            {tab.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
