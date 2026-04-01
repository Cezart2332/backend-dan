const EXPO_PUSH_API_URL = 'https://exp.host/--/api/v2/push/send';

export function isExpoPushToken(token) {
  if (typeof token !== 'string') return false;
  return /^Expo(nent)?PushToken\[[^\]]+\]$/.test(token.trim());
}

export async function sendPushToExpoTokens({ tokens = [], title, body, data = {}, logger }) {
  const cleanedTokens = [...new Set(tokens.map((t) => String(t || '').trim()).filter((t) => isExpoPushToken(t)))];
  if (!cleanedTokens.length) {
    return { sentCount: 0, invalidTokens: [] };
  }

  const messages = cleanedTokens.map((to) => ({
    to,
    title,
    body,
    data,
    sound: 'default',
    priority: 'high',
  }));

  try {
    const response = await fetch(EXPO_PUSH_API_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      logger?.error({ status: response.status, payload }, 'Expo push API returned non-OK status');
      return { sentCount: 0, invalidTokens: [] };
    }

    const results = Array.isArray(payload?.data) ? payload.data : [];
    const invalidTokens = [];
    let sentCount = 0;

    for (let i = 0; i < results.length; i += 1) {
      const result = results[i] || {};
      const token = cleanedTokens[i];
      if (result.status === 'ok') {
        sentCount += 1;
        continue;
      }
      if (result.status === 'error' && result?.details?.error === 'DeviceNotRegistered' && token) {
        invalidTokens.push(token);
      }
      logger?.warn({ token, result }, 'Expo push send returned an error ticket');
    }

    return { sentCount, invalidTokens };
  } catch (error) {
    logger?.error({ err: error }, 'Failed to send Expo push notifications');
    return { sentCount: 0, invalidTokens: [] };
  }
}
