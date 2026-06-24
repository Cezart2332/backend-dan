import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
  Pressable,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { api } from '../utils/api';
import { getToken } from '../utils/authStorage';

const SLOT_TIMES = ['09:00', '10:30', '12:00', '14:00', '16:00', '18:00'];
const DURATION_OPTIONS = [45, 60, 90];
const SHARED_PUSH_TOKEN_KEY = 'quote_push_token';
const DIRECT_PUSH_REGISTERED_KEY = 'direct_push_registered_v1';

export default function DirectScreen({ navigation }) {
  const [bookingVisible, setBookingVisible] = React.useState(false);
  const [selectedDayOffset, setSelectedDayOffset] = React.useState(0);
  const [selectedTime, setSelectedTime] = React.useState(SLOT_TIMES[1]);
  const [duration, setDuration] = React.useState(60);
  const [notes, setNotes] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);

  const selectedDate = React.useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + selectedDayOffset);
    return d;
  }, [selectedDayOffset]);

  const enableMeetingUpdateNotifications = React.useCallback(async (authToken) => {
    if (!authToken) return;

    try {
      const alreadyRegistered = await AsyncStorage.getItem(DIRECT_PUSH_REGISTERED_KEY);
      if (alreadyRegistered === '1') return;

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') return;

      let expoPushToken = await AsyncStorage.getItem(SHARED_PUSH_TOKEN_KEY);
      if (!expoPushToken) {
        const projectId = Constants?.expoConfig?.extra?.eas?.projectId || Constants?.easConfig?.projectId;
        const tokenResult = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
        expoPushToken = tokenResult?.data || null;
        if (expoPushToken) {
          await AsyncStorage.setItem(SHARED_PUSH_TOKEN_KEY, expoPushToken);
        }
      }

      if (expoPushToken) {
        await api.registerPushToken({ token: expoPushToken, platform: Platform.OS, enabled: true }, authToken);
        await AsyncStorage.setItem(DIRECT_PUSH_REGISTERED_KEY, '1');
      }
    } catch (error) {
      console.warn('Direct meeting notifications setup failed:', error?.message || error);
    }
  }, []);

  const openBookingModal = () => {
    setBookingVisible(true);
  };

  const closeBookingModal = () => {
    if (submitting) return;
    setBookingVisible(false);
  };

  const createMeeting = async () => {
    const token = await getToken();
    if (!token) {
      Alert.alert('Autentificare necesară', 'Te rugăm să te autentifici pentru a programa o întâlnire cu Dan.');
      return;
    }

    setSubmitting(true);
    try {
      const [hours, minutes] = selectedTime.split(':').map(Number);
      const meetingDate = new Date(selectedDate);
      meetingDate.setHours(hours, minutes, 0, 0);

      await api.createMeeting(
        {
          title: 'Ședință cu Dan',
          notes: notes.trim() || null,
          duration_min: duration,
          scheduled_at: meetingDate.toISOString(),
        },
        token
      );

      await enableMeetingUpdateNotifications(token);

      setBookingVisible(false);
      setNotes('');
      setSelectedDayOffset(0);
      setSelectedTime(SLOT_TIMES[1]);
      setDuration(60);

      Alert.alert(
        'Programare trimisă',
        `Cererea ta pentru ${formatDisplayDate(meetingDate)} la ${selectedTime} a fost trimisă către Dan.`
      );
    } catch (e) {
      Alert.alert('Eroare', e?.message || 'Nu am putut crea programarea. Încearcă din nou.');
    } finally {
      setSubmitting(false);
    }
  };

  const sendJournal = () => {
    // Placeholder action; wire to your journal sending flow
    Alert.alert('Jurnal trimis', 'Jurnalul tău a fost trimis către Dan.');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient colors={['#dfeeff', '#f4f9ff', '#edf8f4']} style={styles.gradient}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.75}>
              <Ionicons name="chevron-back" size={22} color="#2f73d8" />
            </TouchableOpacity>
            <View style={styles.headerText}>
              <Text style={styles.title}>Intră în direct cu Dan</Text>
              <Text style={styles.subtitle}>Programează o sesiune sau trimite jurnalul pentru analiză</Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Programează-te</Text>
            <Text style={styles.cardText}>Deschide calendarul intern și rezervă direct un interval cu Dan.</Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={openBookingModal}>
              <LinearGradient colors={["#2f73d8", "#2158ad"]} style={styles.btnInner}>
                <Text style={styles.primaryText}>Programează-te</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Trimite jurnalul</Text>
            <Text style={styles.cardText}>Trimite-ți jurnalul către Dan pentru feedback.</Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={sendJournal}>
              <LinearGradient colors={["#3f9f64", "#4cae4c"]} style={styles.btnInner}>
                <Text style={styles.primaryText}>Trimite jurnal</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </ScrollView>

        <Modal visible={bookingVisible} transparent animationType="fade" onRequestClose={closeBookingModal}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Programează o întâlnire cu Dan</Text>
                <TouchableOpacity onPress={closeBookingModal} disabled={submitting}>
                  <Ionicons name="close" size={22} color="#5f7690" />
                </TouchableOpacity>
              </View>

              <Text style={styles.sectionLabel}>Zi</Text>
              <View style={styles.dayRow}>
                <TouchableOpacity
                  style={[styles.navDayBtn, selectedDayOffset <= 0 && styles.navDayBtnDisabled]}
                  onPress={() => setSelectedDayOffset((v) => Math.max(0, v - 1))}
                  disabled={selectedDayOffset <= 0 || submitting}
                >
                  <Ionicons name="chevron-back" size={18} color="#2f73d8" />
                </TouchableOpacity>
                <Text style={styles.selectedDayText}>{formatDayLabel(selectedDate)}</Text>
                <TouchableOpacity
                  style={[styles.navDayBtn, selectedDayOffset >= 20 && styles.navDayBtnDisabled]}
                  onPress={() => setSelectedDayOffset((v) => Math.min(20, v + 1))}
                  disabled={selectedDayOffset >= 20 || submitting}
                >
                  <Ionicons name="chevron-forward" size={18} color="#2f73d8" />
                </TouchableOpacity>
              </View>

              <Text style={styles.sectionLabel}>Ora</Text>
              <View style={styles.choiceWrap}>
                {SLOT_TIMES.map((slot) => (
                  <Pressable
                    key={slot}
                    style={[styles.choiceChip, selectedTime === slot && styles.choiceChipSelected]}
                    onPress={() => setSelectedTime(slot)}
                    disabled={submitting}
                  >
                    <Text style={[styles.choiceChipText, selectedTime === slot && styles.choiceChipTextSelected]}>{slot}</Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.sectionLabel}>Durată</Text>
              <View style={styles.choiceWrap}>
                {DURATION_OPTIONS.map((opt) => (
                  <Pressable
                    key={opt}
                    style={[styles.choiceChip, duration === opt && styles.choiceChipSelected]}
                    onPress={() => setDuration(opt)}
                    disabled={submitting}
                  >
                    <Text style={[styles.choiceChipText, duration === opt && styles.choiceChipTextSelected]}>{opt} min</Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.sectionLabel}>Notițe pentru Dan (opțional)</Text>
              <TextInput
                style={styles.notesInput}
                placeholder="Spune pe scurt ce ai vrea să discutați..."
                placeholderTextColor="#7d93aa"
                multiline
                value={notes}
                onChangeText={setNotes}
                editable={!submitting}
              />

              <TouchableOpacity style={[styles.primaryBtn, submitting && { opacity: 0.7 }]} onPress={createMeeting} disabled={submitting}>
                <LinearGradient colors={["#2f73d8", "#2158ad"]} style={styles.btnInner}>
                  {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Confirmă programarea</Text>}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </LinearGradient>
    </SafeAreaView>
  );
}

function formatDayLabel(date) {
  return date.toLocaleDateString('ro-RO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

function formatDisplayDate(date) {
  return date.toLocaleDateString('ro-RO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#dfeeff' },
  gradient: { flex: 1 },
  content: { padding: 20 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 24, marginTop: 4 },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.88)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(117,154,194,0.18)',
    shadowColor: '#2f73d8', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12, shadowRadius: 6, elevation: 3, marginRight: 14,
  },
  headerText: { flex: 1 },
  title: { fontSize: 20, fontWeight: '700', color: '#18324f' },
  subtitle: { fontSize: 13, color: '#58718e', marginTop: 2 },
  card: {
    backgroundColor: 'rgba(255,255,255,0.86)', borderRadius: 18, padding: 18, marginBottom: 14,
    borderWidth: 1, borderColor: 'rgba(117,154,194,0.18)',
    shadowColor: '#2f73d8', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#18324f', marginBottom: 6 },
  cardText: { fontSize: 14, color: '#58718e' },
  primaryBtn: { marginTop: 12, borderRadius: 12, overflow: 'hidden' },
  btnInner: { paddingVertical: 12, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '700' },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(20,35,55,0.45)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: 'rgba(245,251,255,0.98)',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(180,205,230,0.7)',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#18324f', flex: 1, marginRight: 8 },
  sectionLabel: { marginTop: 8, marginBottom: 6, color: '#5f7690', fontSize: 13, fontWeight: '600' },

  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navDayBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(47,115,216,0.1)',
  },
  navDayBtnDisabled: { opacity: 0.4 },
  selectedDayText: { flex: 1, textAlign: 'center', color: '#18324f', fontWeight: '600', textTransform: 'capitalize' },

  choiceWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choiceChip: {
    borderWidth: 1,
    borderColor: 'rgba(145,180,215,0.65)',
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  choiceChipSelected: {
    borderColor: '#2f73d8',
    backgroundColor: 'rgba(47,115,216,0.12)',
  },
  choiceChipText: { color: '#466581', fontWeight: '600' },
  choiceChipTextSelected: { color: '#2158ad' },

  notesInput: {
    minHeight: 80,
    borderWidth: 1,
    borderColor: 'rgba(145,180,215,0.65)',
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.94)',
    color: '#18324f',
    padding: 10,
    textAlignVertical: 'top',
  },
});
