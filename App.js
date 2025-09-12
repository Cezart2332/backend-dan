import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
import LoginScreen from './components/LoginScreen';
import RegisterScreen from './components/RegisterScreen';
import DashboardScreen from './components/DashboardScreen';
import ProvocarilScreen from './components/ProvocarilScreen';
import ProgressScreen from './components/ProgressScreen';
import OnboardingQuestionsScreen from './components/OnboardingQuestionsScreen';
import QuoteOfTheDayScreen from './components/QuoteOfTheDayScreen';
import TehniciScreen from './components/TehniciScreen';
import AjutorScreen from './components/AjutorScreen';
import LevelChallengesScreen from './components/LevelChallengesScreen';
import ChallengeRunScreen from './components/ChallengeRunScreen';
import DirectScreen from './components/DirectScreen';
import IntrebariScreen from './components/IntrebariScreen';
import AboutDanScreen from './components/AboutDanScreen';
import AboutDanSectionScreen from './components/AboutDanSectionScreen';

const Stack = createStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar style="light" backgroundColor="#4a90e2" />
      <Stack.Navigator
        initialRouteName="Login"
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Register" component={RegisterScreen} />
        <Stack.Screen name="Dashboard" component={DashboardScreen} />
        <Stack.Screen name="Provocari" component={ProvocarilScreen} />
        <Stack.Screen name="Progress" component={ProgressScreen} />
  <Stack.Screen name="Onboarding" component={OnboardingQuestionsScreen} />
  <Stack.Screen name="QuoteOfTheDay" component={QuoteOfTheDayScreen} />
  <Stack.Screen name="Tehnici" component={TehniciScreen} />
  <Stack.Screen name="Ajutor" component={AjutorScreen} />
  <Stack.Screen name="LevelChallenges" component={LevelChallengesScreen} />
  <Stack.Screen name="ChallengeRun" component={ChallengeRunScreen} />
  <Stack.Screen name="Direct" component={DirectScreen} />
  <Stack.Screen name="Intrebari" component={IntrebariScreen} />
  <Stack.Screen name="AboutDan" component={AboutDanScreen} />
  <Stack.Screen name="AboutDanSection" component={AboutDanSectionScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
