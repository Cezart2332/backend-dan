const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Redirect @stripe/stripe-react-native to a web stub on the web platform
// to avoid "importing native-only module" errors.
const stripeWebStub = path.resolve(__dirname, 'utils/stripe-native-web-stub.js');

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && moduleName === '@stripe/stripe-react-native') {
    return { type: 'sourceFile', filePath: stripeWebStub };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
