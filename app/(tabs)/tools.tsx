import { Text, View, Pressable, ScrollView, Alert } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useFamily } from "@/lib/family-store";
import { exportFamilyTreePDF, printFamilyTree } from "@/lib/pdf-export";
import { useState } from "react";

interface ToolCardProps {
  title: string;
  description: string;
  icon: any;
  onPress: () => void;
  color: string;
  loading?: boolean;
}

function ToolCard({ title, description, icon, onPress, color, loading }: ToolCardProps) {
  const colors = useColors();
  return (
    <Pressable onPress={loading ? undefined : onPress} style={({ pressed }) => [{ opacity: loading ? 0.5 : pressed ? 0.7 : 1 }]}>
      <View className="flex-row items-center bg-surface rounded-2xl p-4 border border-border gap-4">
        <View
          className="w-12 h-12 rounded-xl items-center justify-center"
          style={{ backgroundColor: color + "18" }}
        >
          <IconSymbol name={icon} size={26} color={color} />
        </View>
        <View className="flex-1">
          <Text className="text-base font-semibold text-foreground">{title}</Text>
          <Text className="text-xs text-muted mt-0.5">{loading ? "Generating..." : description}</Text>
        </View>
        <IconSymbol name="chevron.right" size={18} color={colors.muted} />
      </View>
    </Pressable>
  );
}

export default function ToolsScreen() {
  const router = useRouter();
  const colors = useColors();
  const { data } = useFamily();
  const [exporting, setExporting] = useState(false);

  const muslimCount = data.persons.filter((p) => p.religion === "Islam").length;

  const handleExportPDF = async () => {
    if (data.persons.length === 0) {
      Alert.alert("No Data", "Please add family members before exporting.");
      return;
    }
    setExporting(true);
    try {
      await exportFamilyTreePDF(data);
    } catch (e) {
      Alert.alert("Export Failed", "Could not generate PDF. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  const handlePrint = async () => {
    if (data.persons.length === 0) {
      Alert.alert("No Data", "Please add family members before printing.");
      return;
    }
    try {
      await printFamilyTree(data);
    } catch (e) {
      Alert.alert("Print Failed", "Could not print. Please try again.");
    }
  };

  return (
    <ScreenContainer className="px-5 pt-2">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        <Text className="text-2xl font-bold text-foreground mb-1">Tools</Text>
        <Text className="text-sm text-muted mb-6">Powerful features for your family tree</Text>

        {/* Islamic Tools Section */}
        <Text className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Islamic Tools</Text>
        <View className="gap-3 mb-6">
          <ToolCard
            title="Faraid Calculator"
            description="Calculate Islamic inheritance distribution"
            icon="chart.pie.fill"
            color={colors.primary}
            onPress={() => router.push("/faraid-calculator" as any)}
          />
          <ToolCard
            title="Mahram Checker"
            description="Check Mahram relationships between two people"
            icon="person.2.fill"
            color={colors.accent}
            onPress={() => router.push("/mahram-checker" as any)}
          />
        </View>

        {/* Export & Print Section */}
        <Text className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Export & Print</Text>
        <View className="gap-3 mb-6">
          <ToolCard
            title="Export Family Tree PDF"
            description="Generate a printable family tree report"
            icon="arrow.down.doc.fill"
            color="#E65100"
            onPress={handleExportPDF}
            loading={exporting}
          />
          <ToolCard
            title="Print Family Tree"
            description="Print your family tree directly"
            icon="doc.text.fill"
            color="#FF9500"
            onPress={handlePrint}
          />
        </View>

        {/* Family Tools Section */}
        <Text className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Family Management</Text>
        <View className="gap-3 mb-6">
          <ToolCard
            title="Invite Family"
            description="Share your tree with siblings and relatives"
            icon="envelope.fill"
            color="#5856D6"
            onPress={() => router.push("/invite-family" as any)}
          />
          <ToolCard
            title="Family Statistics"
            description={`${data.persons.length} members · ${muslimCount} Muslim`}
            icon="info.circle.fill"
            color="#34C759"
            onPress={() => {}}
          />
        </View>

        {/* Info Card */}
        <View className="bg-primary/8 rounded-2xl p-4 border border-primary/20">
          <View className="flex-row items-start gap-3">
            <IconSymbol name="info.circle.fill" size={20} color={colors.primary} />
            <View className="flex-1">
              <Text className="text-sm font-medium text-foreground mb-1">About Faraid</Text>
              <Text className="text-xs text-muted leading-relaxed">
                Faraid is the Islamic law of inheritance that determines how a deceased Muslim's estate 
                is distributed among eligible heirs. The calculator uses your family tree data to 
                automatically identify heirs and compute their shares.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
