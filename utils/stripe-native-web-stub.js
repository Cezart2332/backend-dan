// Web stub for @stripe/stripe-react-native
// This module is native-only; on web, payments go through the hosted Stripe Checkout URL fallback.
import React from 'react';

export function StripeProvider({ children }) {
  return React.createElement(React.Fragment, null, children);
}

export function useStripe() {
  const notSupported = () => Promise.resolve({ error: { message: 'Native Stripe not supported on web', code: 'Unsupported' } });
  return {
    initPaymentSheet: notSupported,
    presentPaymentSheet: notSupported,
    confirmPayment: notSupported,
    createPaymentMethod: notSupported,
    retrievePaymentIntent: notSupported,
    handleNextAction: notSupported,
  };
}
