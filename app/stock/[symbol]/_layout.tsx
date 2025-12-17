import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Tabs, useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { TouchableOpacity } from 'react-native';

// Tab bar icon component similar to main tabs
function TabBarIcon(props: {
  name: React.ComponentProps<typeof FontAwesome>['name'];
  color: string;
}) {
  return <FontAwesome size={18} style={{ marginBottom: -3 }} {...props} />;
}

export default function StockDetailLayout() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const router = useRouter();
  const { symbol } = useLocalSearchParams<{ symbol: string }>();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colorScheme === 'dark' ? '#2f95dc' : '#1976d2',
        tabBarInactiveTintColor: colorScheme === 'dark' ? '#888' : '#666',
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopWidth: 1,
          borderTopColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
        },
        tabBarLabelStyle: {
          fontSize: 16,
          fontWeight: '500',
        },
        headerShown: true,
        headerStyle: {
          backgroundColor: colors.background,
        },
        headerTintColor: colorScheme === 'dark' ? '#fff' : '#000',
        headerTitleStyle: {
          fontWeight: '600',
        },
        headerTitle: symbol || 'Stock',
        headerLeft: () => (
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ marginLeft: 16, padding: 8 }}
          >
            <FontAwesome
              name="chevron-left"
              size={16}
              color={colorScheme === 'dark' ? '#fff' : '#000'}
            />
          </TouchableOpacity>
        ),
      }}
    >
      <Tabs.Screen
        name="chart"
        options={{
          title: 'Chart',
          tabBarLabel: 'Chart',
          tabBarIcon: ({ color }) => <TabBarIcon name="line-chart" color={color} />,
        }}
      />
      <Tabs.Screen
        name="transactions"
        options={{
          title: 'Transactions',
          tabBarLabel: 'Transactions',
          tabBarIcon: ({ color }) => <TabBarIcon name="exchange" color={color} />,
        }}
      />
    </Tabs>
  );
}

