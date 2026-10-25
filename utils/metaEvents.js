let AppEventsLogger = null;

try {
  const fbsdk = require('react-native-fbsdk-next');
  AppEventsLogger = fbsdk.AppEventsLogger;
} catch (e) {
  AppEventsLogger = null;
}

const STANDARD_EVENTS = {
  COMPLETED_REGISTRATION: 'fb_mobile_complete_registration',
  COMPLETED_TUTORIAL: 'fb_mobile_tutorial_completion',
  ACHIEVED_LEVEL: 'fb_mobile_level_achieved',
  UNLOCKED_ACHIEVEMENT: 'fb_mobile_achievement_unlocked',
  VIEWED_CONTENT: 'fb_mobile_content_view',
  ADDED_PAYMENT_INFO: 'fb_mobile_add_payment_info',
  INITIATED_CHECKOUT: 'fb_mobile_initiated_checkout',
  PURCHASED: 'fb_mobile_purchase',
  SUBSCRIBED: 'fb_mobile_purchase',
  START_TRIAL: 'fb_start_trial',
  AD_IMPRESSION: 'fb_mobile_ad_impression',
  AD_CLICK: 'fb_mobile_ad_click',
  SEARCHED: 'fb_mobile_search',
  RATED: 'fb_mobile_rate',
  SPENT_CREDITS: 'fb_mobile_spent_credits',
};

function isAvailable() {
  return AppEventsLogger !== null;
}

function logEvent(eventName, params, valueToSum) {
  if (!isAvailable()) return;
  try {
    AppEventsLogger.logEvent(eventName, params || {}, valueToSum);
  } catch (e) {}
}

function setAdvertiserTrackingEnabled(enabled) {
  if (!isAvailable()) return;
  try {
    AppEventsLogger.setAdvertiserTrackingEnabled(enabled);
  } catch (e) {}
}

export default {
  isAvailable,
  STANDARD_EVENTS,
  logEvent,
  setAdvertiserTrackingEnabled,
};
