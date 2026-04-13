import React, { useEffect, useRef, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { StatusBar } from "expo-status-bar";
import * as Notifications from "expo-notifications";
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
import WebinariiScreen from "./components/WebinariiScreen";
import AboutDanScreen from "./components/AboutDanScreen";
import AboutDanSectionScreen from "./components/AboutDanSectionScreen";
import ProgressHistoryScreen from "./components/ProgressHistoryScreen";
import ProgressDetailScreen from "./components/ProgressDetailScreen";
import ChallengeHistoryScreen from "./components/ChallengeHistoryScreen";
import ChallengeDetailScreen from "./components/ChallengeDetailScreen";
import AboutDanIntroScreen from "./components/AboutDanIntroScreen";
import AboutDanCineVideoScreen from "./components/AboutDanCineVideoScreen";
import AjutorAnxietateVideoScreen from "./components/AjutorAnxietateVideoScreen";
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
import MedicalInfoScreen from "./components/MedicalInfoScreen";
import CommunityChatScreen from "./components/CommunityChatScreen";
import { getToken, clearToken } from "./utils/authStorage";
import { SubscriptionProvider } from "./contexts/SubscriptionContext";
import SubscriptionPaywall from "./components/SubscriptionPaywall";
import { clearSubscription } from "./utils/subscriptionStorage";
import { clearUser } from "./utils/userStorage";
import { clearEntries } from "./utils/progressStorage";
import { replaceAllRuns } from "./utils/challengeStorage";
import { api } from "./utils/api";
import AppSplashScreen from "./components/AppSplashScreen";

const Stack = createStackNavigator();
const MIN_SPLASH_MS = 1400;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function App() {
  const [booting, setBooting] = useState(true);
  const [isAuthed, setIsAuthed] = useState(false);
  const navigationRef = useRef(null);
  const [currentRoute, setCurrentRoute] = useState(null);

  useEffect(() => {
    let mounted = true;
    const startedAt = Date.now();
    let bootTimer = null;

    (async () => {
      try {
        const token = await getToken();
        if (!token) {
          if (mounted) setIsAuthed(false);
          return;
        }
        // Validate token against server — if the account was deleted or
        // the DB was wiped, the server returns 401 and we force logout.
        try {
          await api.getCurrentSubscription(token);
          if (mounted) setIsAuthed(true);
        } catch (err) {
          const msg = err?.message || '';
          // 401 / auth errors → account no longer exists, clear everything
          if (msg.includes('Neautorizat') || msg.includes('401') || msg.includes('BAD_TOKEN') || msg.includes('NO_AUTH')) {
            await Promise.allSettled([
              clearToken(),
              clearUser(),
              clearSubscription(),
              clearEntries(),
              replaceAllRuns([]),
            ]);
            if (mounted) setIsAuthed(false);
          } else {
            // Network error / server down → let user in with cached data
            if (mounted) setIsAuthed(true);
          }
        }
      } catch {
        if (mounted) setIsAuthed(false);
      } finally {
        const elapsed = Date.now() - startedAt;
        const waitMs = Math.max(0, MIN_SPLASH_MS - elapsed);
        bootTimer = setTimeout(() => {
          if (mounted) setBooting(false);
        }, waitMs);
      }
    })();

    return () => {
      mounted = false;
      if (bootTimer) clearTimeout(bootTimer);
    };
  }, []);

  useEffect(() => {
    let active = true;
    const handledNotificationIds = new Set();

    const handleResponse = (response) => {
      const notification = response?.notification;
      if (!notification) return;

      const notificationId = notification?.request?.identifier;
      if (notificationId && handledNotificationIds.has(notificationId)) return;
      if (notificationId) handledNotificationIds.add(notificationId);

      const data = notification?.request?.content?.data || {};
      const type = String(data?.type || '').toLowerCase();

      if (type === 'question_response') {
        navigationRef.current?.navigate?.('Intrebari');
        return;
      }

      if (type === 'webinar_created' || type === 'webinar_updated') {
        const webinarId = Number(data?.webinarId);
        navigationRef.current?.navigate?.('Webinarii', {
          focusWebinarId: Number.isFinite(webinarId) ? webinarId : undefined,
        });
        return;
      }

      if (type === 'meeting_updated') {
        navigationRef.current?.navigate?.('Direct');
      }
    };

    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (active && response) handleResponse(response);
      })
      .catch(() => {});

    const responseSubscription = Notifications.addNotificationResponseReceivedListener(handleResponse);

    return () => {
      active = false;
      responseSubscription.remove();
    };
  }, []);

  if (booting) {
    return <AppSplashScreen />;
  }

  const handleNavUpdate = () => {
    const current = navigationRef.current?.getCurrentRoute?.();
    setCurrentRoute(current?.name || null);
  };
  return (
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
            <Stack.Screen name="Webinarii" component={WebinariiScreen} />
            <Stack.Screen name="CommunityChat" component={CommunityChatScreen} />
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
            <Stack.Screen
              name="MedicalInfo"
              component={MedicalInfoScreen}
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
        onLogout={() => setIsAuthed(false)}
      />
    </SubscriptionProvider>
  );
}
