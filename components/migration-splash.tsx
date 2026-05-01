/**
 * Migration Splash Screen
 *
 * Lokasi: components/migration-splash.tsx
 *
 * Tunjuk bila migrasi sedang berjalan (biasanya 1-3 saat untuk keluarga sedia ada).
 * Untuk user baru atau yang dah migrate, tidak akan muncul.
 */

import React from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { useColors } from "@/hooks/use-colors";

export function MigrationSplash({ message }: { message?: string }) {
  const colors = useColors();
  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: colors.background,
        padding: 32,
      }}
    >
      <ActivityIndicator size="large" color={colors.primary} />
      <Text
        style={{
          marginTop: 20,
          fontSize: 16,
          fontWeight: "600",
          color: colors.foreground,
          textAlign: "center",
        }}
      >
        {message ?? "Menaiktaraf pangkalan data..."}
      </Text>
      <Text
        style={{
          marginTop: 8,
          fontSize: 13,
          color: colors.muted,
          textAlign: "center",
          maxWidth: 300,
        }}
      >
        Ini sekali sahaja. Data anda sedang dipindahkan ke format baru yang lebih
        pantas. Sila tunggu sebentar.
      </Text>
    </View>
  );
}
