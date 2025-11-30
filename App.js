import React, { useEffect, useRef, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { StatusBar } from "expo-status-bar";
import { StripeProvider } from "@stripe/stripe-react-native";
import { View, ActivityIndicator, Text } from "react-native";
import LoginScreen from "./components/LoginScreen";
import RegisterScreen from "./components/RegisterScreen";
import DashboardScreen from "./components/DashboardScreen";
import ProvocarilScreen from "./components/ProvocarilScreen";
import ProgressScreen from "./components/ProgressScreen";
import OnboardingQuestionsScreen from "./components/OnboardingQuestionsScreen";
import QuoteOfTheDayScreen from "./components/QuoteOfTheDayScreen";
import TehniciScreen from "./components/TehniciScreen";
import TehnicaHAIDetailScreen from "./components/TehnicaHAIDetailScreen";
import AjutorScreen from "./components/AjutorScreen";
import LevelChallengesScreen from "./components/LevelChallengesScreen";
import ChallengeRunScreen from "./components/ChallengeRunScreen";
import DirectScreen from "./components/DirectScreen";
import IntrebariScreen from "./components/IntrebariScreen";
import AboutDanScreen from "./components/AboutDanScreen";
import AboutDanSectionScreen from "./components/AboutDanSectionScreen";
import ProgressHistoryScreen from "./components/ProgressHistoryScreen";
import ProgressDetailScreen from "./components/ProgressDetailScreen";
import ChallengeHistoryScreen from "./components/ChallengeHistoryScreen";
import ChallengeDetailScreen from "./components/ChallengeDetailScreen";
import AboutDanIntroScreen from "./components/AboutDanIntroScreen";
import AboutDanCineVideoScreen from "./components/AboutDanCineVideoScreen";
import AjutorAnxietateVideoScreen from "./components/AjutorAnxietateVideoScreen";
import AjutorRauVideoScreen from "./components/AjutorRau";
import SubscriptionsScreen from "./components/SubscriptionsScreen";
import IntelegeAnxietateScreen from "./components/IntelegeAnxietateScreen";
import IntelegeAnxietateVideoScreen from "./components/IntelegeAnxietateVideoScreen";
import TermsScreen from "./components/TermsScreen";
import AjutorAnxietateListScreen from "./components/AjutorAnxietateListScreen";
import AjutorAtacPanicaListScreen from "./components/AjutorAtacPanicaListScreen";
import AjutorAtacPanicaVideoScreen from "./components/AjutorAtacPanicaVideoScreen";
import DinExperientaMeaScreen from "./components/DinExperientaMeaScreen";
import DinExperientaMeaVideoScreen from "./components/DinExperientaMeaVideoScreen";
import AudioAnxietateListScreen from "./components/AudioAnxietateListScreen";
import AudioAnxietateVideoScreen from "./components/AudioAnxietateVideoScreen";
import TehnicaHAIPsihologiceScreen from "./components/TehnicaHAIPsihologiceScreen";
import TehnicaHAIFiziceScreen from "./components/TehnicaHAIFiziceScreen";
import TehnicaHAIVideoScreen from "./components/TehnicaHAIVideoScreen";
import SettingsScreen from "./components/SettingsScreen";
import { getToken } from "./utils/authStorage";
import { getStripePublishableKey } from "./utils/stripe";
import { SubscriptionProvider } from "./contexts/SubscriptionContext";
import SubscriptionPaywall from "./components/SubscriptionPaywall";

const Stack = createStackNavigator();

export default function App() {
  const [booting, setBooting] = useState(true);
  const [isAuthed, setIsAuthed] = useState(false);
  const navigationRef = useRef(null);
  const [currentRoute, setCurrentRoute] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const token = await getToken();
        if (mounted) setIsAuthed(!!token);
      } catch {
      } finally {
        if (mounted) setBooting(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  if (booting) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#f0f8ff",
        }}
      >
        <ActivityIndicator size="large" color="#4a90e2" />
        <Text style={{ marginTop: 12, color: "#4a90e2" }}>
          Se pregătește aplicația...
        </Text>
      </View>
    );
  }

  const publishableKey = getStripePublishableKey();
  const handleNavUpdate = () => {
    const current = navigationRef.current?.getCurrentRoute?.();
    setCurrentRoute(current?.name || null);
  };
  return (
    <StripeProvider
      publishableKey={publishableKey || ""}
      merchantIdentifier="merchant.dan.anxiety" // Apple Pay (placeholder)
      urlScheme="dananxiety" // 3DS / bank redirects (placeholder)
    >
      <SubscriptionProvider isAuthed={isAuthed}>
        <NavigationContainer
          ref={navigationRef}
          onReady={handleNavUpdate}
          onStateChange={handleNavUpdate}
        >
          <StatusBar style="light" backgroundColor="#4a90e2" />
          <Stack.Navigator
            initialRouteName={isAuthed ? "Dashboard" : "Login"}
            screenOptions={{
              headerShown: false,
            }}
          >
            <Stack.Screen name="Login">
              {(props) => (
                <LoginScreen
                  {...props}
                  onAuthenticated={() => setIsAuthed(true)}
                />
              )}
            </Stack.Screen>
            <Stack.Screen name="Register">
              {(props) => (
                <RegisterScreen
                  {...props}
                  onAuthenticated={() => setIsAuthed(true)}
                />
              )}
            </Stack.Screen>
            <Stack.Screen name="Dashboard">
              {(props) => (
                <DashboardScreen
                  {...props}
                  onLogout={() => setIsAuthed(false)}
                />
              )}
            </Stack.Screen>
            <Stack.Screen name="Provocari" component={ProvocarilScreen} />
            <Stack.Screen name="Progress" component={ProgressScreen} />
            <Stack.Screen
              name="Onboarding"
              component={OnboardingQuestionsScreen}
            />
            <Stack.Screen
              name="QuoteOfTheDay"
              component={QuoteOfTheDayScreen}
            />
            <Stack.Screen name="Tehnici" component={TehniciScreen} />
            <Stack.Screen
              name="TehnicaHAIDetail"
              component={TehnicaHAIDetailScreen}
            />
            <Stack.Screen name="Ajutor" component={AjutorScreen} />
            <Stack.Screen
              name="LevelChallenges"
              component={LevelChallengesScreen}
            />
            <Stack.Screen
              name="ChallengeRun"
              component={ChallengeRunScreen}
            />
            <Stack.Screen name="Direct" component={DirectScreen} />
            <Stack.Screen name="Intrebari" component={IntrebariScreen} />
            <Stack.Screen name="AboutDan" component={AboutDanScreen} />
            <Stack.Screen
              name="AboutDanSection"
              component={AboutDanSectionScreen}
            />
            <Stack.Screen
              name="ProgressHistory"
              component={ProgressHistoryScreen}
            />
            <Stack.Screen
              name="ProgressDetail"
              component={ProgressDetailScreen}
            />
            <Stack.Screen
              name="ChallengeHistory"
              component={ChallengeHistoryScreen}
            />
            <Stack.Screen
              name="ChallengeDetail"
              component={ChallengeDetailScreen}
            />
            <Stack.Screen
              name="AboutDanIntro"
              component={AboutDanIntroScreen}
            />
            <Stack.Screen
              name="AjutorRauVideo"
              component={AjutorRauVideoScreen}
            />
            <Stack.Screen
              name="AboutDanCineVideo"
              component={AboutDanCineVideoScreen}
            />
            <Stack.Screen
              name="AjutorAnxietateVideo"
              component={AjutorAnxietateVideoScreen}
            />
            <Stack.Screen
              name="Subscriptions"
              component={SubscriptionsScreen}
            />
            <Stack.Screen
              name="IntelegeAnxietate"
              component={IntelegeAnxietateScreen}
            />
            <Stack.Screen
              name="IntelegeAnxietateVideo"
              component={IntelegeAnxietateVideoScreen}
            />
            <Stack.Screen
              name="Terms"
              component={TermsScreen}
            />
            <Stack.Screen
              name="AjutorAnxietateList"
              component={AjutorAnxietateListScreen}
            />
            <Stack.Screen
              name="AjutorAtacPanicaList"
              component={AjutorAtacPanicaListScreen}
            />
            <Stack.Screen
              name="AjutorAtacPanicaVideo"
              component={AjutorAtacPanicaVideoScreen}
            />
            <Stack.Screen
              name="DinExperientaMea"
              component={DinExperientaMeaScreen}
            />
            <Stack.Screen
              name="DinExperientaMeaVideo"
              component={DinExperientaMeaVideoScreen}
            />
            <Stack.Screen
              name="AudioAnxietateList"
              component={AudioAnxietateListScreen}
            />
            <Stack.Screen
              name="AudioAnxietateVideo"
              component={AudioAnxietateVideoScreen}
            />
            <Stack.Screen
              name="TehnicaHAIPsihologice"
              component={TehnicaHAIPsihologiceScreen}
            />
            <Stack.Screen
              name="TehnicaHAIFizice"
              component={TehnicaHAIFiziceScreen}
            />
            <Stack.Screen
              name="TehnicaHAIVideo"
              component={TehnicaHAIVideoScreen}
            />
            <Stack.Screen name="Settings">
              {(props) => (
                <SettingsScreen
                  {...props}
                  onLogout={() => setIsAuthed(false)}
                />
              )}
            </Stack.Screen>
          </Stack.Navigator>
        </NavigationContainer>
        <SubscriptionPaywall
          isAuthed={isAuthed}
          navigationRef={navigationRef}
          currentRoute={currentRoute}
        />
      </SubscriptionProvider>
    </StripeProvider>
  );
}
