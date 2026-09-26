import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

export const QUOTES = [
  'Anxietatea scade atunci când încetezi să te mai lupți cu ea și o lași să fie.',
  'Un atac de panică este doar o furtună trecătoare – tu ești cerul care rămâne senin în spate.',
  'Curajul nu înseamnă lipsa fricii, ci alegerea de a merge înainte chiar și cu frică.',
  'Fiecare secundă în care accepți anxietatea este o secundă în care ea pierde din putere.',
  'Atacul de panică pare periculos, dar e doar o alarmă falsă. Tu ești în siguranță.',
  'Nu te teme de ceea ce simți – cu cât privești anxietatea mai direct, cu atât se dizolvă mai repede.',
  'Respiră și lasă corpul să facă ce știe el mai bine: să se liniștească singur.',
  'Anxietatea iubește lupta. Tu o învingi atunci când alegi acceptarea.',
  'Ai trecut prin atâtea până acum – asta dovedește că ești mai puternic decât crezi.',
  'Frica își pierde din intensitate când stai cu ea, nu când fugi de ea.',
  'Atacul de panică este doar o poveste spusă de creierul tău. Tu alegi dacă o crezi.',
  'Ceea ce accepți, se transformă. Ceea ce respingi, persistă.',
  'Ai voie să simți tot – și totuși să mergi mai departe.',
  'Împrietenește-te cu anxietatea și vei descoperi că nu era un dușman, ci o lecție.',
  'Cel mai greu pas e primul: să accepți că nu trebuie să controlezi totul.',
  'Ești deja pe drumul vindecării – pentru că ai ales să privești anxietatea în față.',
];

const ENABLED_KEY = 'quote_notifications_enabled';
const LEGACY_SCHEDULE_ID_KEY = 'quote_notifications_schedule_id';
const ID_PREFIX = 'daily-quote-';
const CHANNEL_ID = 'daily';
const DAILY_HOUR = 9;
const DAILY_MINUTE = 0;
// iOS păstrează maximum 64 de notificări locale programate; restul se
// completează la fiecare deschidere a aplicației.
const DAYS_AHEAD = 45;
const NOTIFICATION_TITLE = 'Gândul de azi de la Dan';

function dayNumber(date) {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
}

/** Gândul unei zile — același pe ecran și în notificarea de dimineață. */
export function quoteForDate(date = new Date()) {
  return QUOTES[dayNumber(date) % QUOTES.length];
}

export function randomQuote(exclude) {
  const pool = QUOTES.filter((quote) => quote !== exclude);
  return pool[Math.floor(Math.random() * pool.length)];
}

export async function isDailyQuoteEnabled() {
  return (await AsyncStorage.getItem(ENABLED_KEY)) === '1';
}

/**
 * @returns {Promise<boolean>} true dacă aplicația are voie să afișeze notificări.
 */
export async function ensureNotificationPermission() {
  const { status } = await Notifications.getPermissionsAsync();
  if (status === 'granted') return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.status === 'granted';
}

async function ensureChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Gândul zilei',
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: 'default',
  });
}

function identifierFor(date) {
  return `${ID_PREFIX}${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

// Versiunile vechi programau o singură notificare, salvată sub acest id.
async function cancelLegacySchedule() {
  const legacyId = await AsyncStorage.getItem(LEGACY_SCHEDULE_ID_KEY);
  if (!legacyId) return;
  await Notifications.cancelScheduledNotificationAsync(legacyId).catch(() => {});
  await AsyncStorage.removeItem(LEGACY_SCHEDULE_ID_KEY);
}

async function cancelDailyQuoteNotifications() {
  await cancelLegacySchedule();

  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((item) => String(item?.identifier || '').startsWith(ID_PREFIX))
      .map((item) => Notifications.cancelScheduledNotificationAsync(item.identifier).catch(() => {}))
  );
}

// Câte o notificare pe zi, fiecare cu gândul acelei zile. Programează doar
// zilele lipsă, ca apelul de la pornirea aplicației să fie ieftin.
async function scheduleUpcomingQuotes() {
  await ensureChannel();
  await cancelLegacySchedule();

  const now = new Date();
  const wanted = [];
  for (let offset = 0; offset <= DAYS_AHEAD; offset += 1) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset, DAILY_HOUR, DAILY_MINUTE, 0, 0);
    if (date.getTime() > now.getTime()) wanted.push(date);
  }
  const wantedIds = new Set(wanted.map(identifierFor));

  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const existingIds = new Set();
  for (const item of scheduled) {
    const id = String(item?.identifier || '');
    if (!id.startsWith(ID_PREFIX)) continue;
    if (wantedIds.has(id)) existingIds.add(id);
    else await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
  }

  for (const date of wanted) {
    const identifier = identifierFor(date);
    if (existingIds.has(identifier)) continue;
    const quote = quoteForDate(date);
    await Notifications.scheduleNotificationAsync({
      identifier,
      content: {
        title: NOTIFICATION_TITLE,
        body: quote,
        sound: 'default',
        data: { type: 'daily_quote', quote },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date,
        channelId: CHANNEL_ID,
      },
    });
  }
}

/**
 * Pornește gândul zilnic. Starea „pornit” se salvează doar după ce
 * programarea a reușit, ca switch-ul să reflecte realitatea.
 *
 * @returns {Promise<{ ok: true } | { ok: false, reason: 'permission' }>}
 */
export async function enableDailyQuote() {
  const granted = await ensureNotificationPermission();
  if (!granted) return { ok: false, reason: 'permission' };

  await scheduleUpcomingQuotes();
  await AsyncStorage.setItem(ENABLED_KEY, '1');
  return { ok: true };
}

export async function disableDailyQuote() {
  await AsyncStorage.setItem(ENABLED_KEY, '0');
  await cancelDailyQuoteNotifications();
}

/** Completează programările la pornirea aplicației (dacă gândul zilnic e activ). */
export async function syncDailyQuoteSchedule() {
  if (!(await isDailyQuoteEnabled())) return;
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') return;
  await scheduleUpcomingQuotes();
}
