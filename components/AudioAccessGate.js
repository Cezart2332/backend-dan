import React from 'react';
import { Text } from 'react-native';
import { useSubscription } from '../contexts/SubscriptionContext';
import { AppButton, AppHeader, AppScreen } from './ui';
import { colors, fonts } from './ui/theme';
import { useTheme } from './ui/themeContext';
import Illustration from './Illustration';

// The new profile shortcut must keep the paid-access rule of the dashboard.
export default function AudioAccessGate({ navigation, children }) {
  const { subscription, hasProEntitlement } = useSubscription();
  const { tc } = useTheme();
  const paid = hasProEntitlement || ['basic','premium','vip','pro'].includes(String(subscription?.type || '').toLowerCase());
  if (paid) return children;
  return <AppScreen>
    <AppHeader title="Lecțiile lui Dan" onBack={() => navigation.goBack()} />
    <Illustration size={140} />
    <Text style={{ fontFamily: fonts.display, fontSize: 25, lineHeight: 33, color: tc(colors.text,'fg'), marginVertical: 20 }}>Lecțiile sunt disponibile cu abonament activ.</Text>
    <AppButton title="Vezi abonamente" onPress={() => navigation.navigate('Subscriptions')} />
  </AppScreen>;
}
