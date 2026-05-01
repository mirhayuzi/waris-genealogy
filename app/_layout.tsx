/**
 * Root Layout — updated with migration gate
 *
 * Lokasi: app/_layout.tsx (ganti yang sedia ada)
 *
 * Perbezaan dari versi lama:
 *  1. Import FamilyProvider masih sama path "@/lib/family-store"
 *     (kita ganti fail itu sendiri, bukan buat fail baru)
 *  2. Tambah FamilyMigrationGate untuk tunjuk splash semasa migrasi
 */

import "@/global.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";
import { Platform } from "react-native";
import "@/lib/_core/nativewind-pressable";
import { ThemeProvider } from "@/lib/theme-provider";
import {
  SafeAreaFrameContext,
  SafeAreaInsetsContext,
  SafeAreaProvider,
  initialWindowMetrics,
} from "react-native-safe-area-context";
import type { EdgeInsets, Metrics, Rect } from "react-native-safe-area-context";

import { trpc, createTRPCClient } from "@/lib/trpc";
import { initManusRuntime, subscribeSafeAreaInsets } from "@/lib/_core/manus-runtime";
import { FamilyProvider, useFamily } from "@/lib/family-store";
import { MigrationSplash } from "@/components/migration-splash";
import { I18nProvider } from "@/lib/i18n";

const DEFAULT_WEB_INSETS: EdgeInsets = { top: 0, right: 0, bottom: 0, left: 0 };
const DEFAULT_WEB_FRAME: Rect = { x: 0, y: 0, width: 0, height: 0 };

export const unstable_settings = {
  anchor: "(tabs)",
};

/**
 * Gate yang tunggu migrasi selesai sebelum render tree utama.
 * Kalau tiada migrasi (user baru atau dah migrate), pass-through serta-merta.
 */
function FamilyMigrationGate({ children }: { children: React.ReactNode }) {
  const { isMigrating } = useFamily();
  if (isMigrating) {
    return <MigrationSplash message="Memindahkan data keluarga..." />;
  }
  return <>{children}</>;
}

export default function RootLayout() {
  const initialInsets = initialWindowMetrics?.insets ?? DEFAULT_WEB_INSETS;
  const initialFrame = initialWindowMetrics?.frame ?? DEFAULT_WEB_FRAME;

  const [insets, setInsets] = useState<EdgeInsets>(initialInsets);
  const [frame, setFrame] = useState<Rect>(initialFrame);

  useEffect(() => {
    initManusRuntime();
  }, []);

  const handleSafeAreaUpdate = useCallback((metrics: Metrics) => {
    setInsets(metrics.insets);
    setFrame(metrics.frame);
  }, []);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const unsubscribe = subscribeSafeAreaInsets(handleSafeAreaUpdate);
    return () => unsubscribe();
  }, [handleSafeAreaUpdate]);

  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
  );
  const [trpcClient] = useState(() => createTRPCClient());

  const providerInitialMetrics = useMemo(() => {
    const metrics = initialWindowMetrics ?? { insets: initialInsets, frame: initialFrame };
    return {
      ...metrics,
      insets: {
        ...metrics.insets,
        top: Math.max(metrics.insets.top, 16),
        bottom: Math.max(metrics.insets.bottom, 12),
      },
    };
  }, [initialInsets, initialFrame]);

  const content = (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <I18nProvider>
        <FamilyProvider>
          <FamilyMigrationGate>
            <trpc.Provider client={trpcClient} queryClient={queryClient}>
              <QueryClientProvider client={queryClient}>
                <Stack screenOptions={{ headerShown: false }}>
                  <Stack.Screen name="(tabs)" />
                  <Stack.Screen name="add-member" options={{ presentation: "modal" }} />
                  <Stack.Screen name="edit-member" options={{ presentation: "modal" }} />
                  <Stack.Screen name="member-profile" />
                  <Stack.Screen name="faraid-calculator" />
                  <Stack.Screen name="mahram-checker" />
                  <Stack.Screen name="invite-family" options={{ presentation: "modal" }} />
                  <Stack.Screen name="family-timeline" />
                  <Stack.Screen name="miller-columns" />
                  <Stack.Screen name="backup-restore" />
                  <Stack.Screen name="oauth/callback" />
                </Stack>
                <StatusBar style="auto" />
              </QueryClientProvider>
            </trpc.Provider>
          </FamilyMigrationGate>
        </FamilyProvider>
      </I18nProvider>
    </GestureHandlerRootView>
  );

  const shouldOverrideSafeArea = Platform.OS === "web";

  if (shouldOverrideSafeArea) {
    return (
      <ThemeProvider>
        <SafeAreaProvider initialMetrics={providerInitialMetrics}>
          <SafeAreaFrameContext.Provider value={frame}>
            <SafeAreaInsetsContext.Provider value={insets}>
              {content}
            </SafeAreaInsetsContext.Provider>
          </SafeAreaFrameContext.Provider>
        </SafeAreaProvider>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <SafeAreaProvider initialMetrics={providerInitialMetrics}>{content}</SafeAreaProvider>
    </ThemeProvider>
  );
}
