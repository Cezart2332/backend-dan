import React from "react";
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { reportError } from "../utils/monitoring";

let showFatalError = null;

// Erorile fatale din afara randării (efecte, promisiuni, timere) ar lăsa pe iOS
// un ecran alb fără nicio explicație; le afișăm în schimb pe ecranul de eroare.
const ErrorUtilsRef = global.ErrorUtils;
if (ErrorUtilsRef?.setGlobalHandler) {
  const previousHandler = ErrorUtilsRef.getGlobalHandler?.();
  ErrorUtilsRef.setGlobalHandler((error, isFatal) => {
    if (isFatal) reportError(error, { fatal: true });
    if (isFatal && showFatalError) {
      showFatalError(error);
      return;
    }
    previousHandler?.(error, isFatal);
  });
}

function describe(error) {
  if (!error) return "Eroare necunoscută";
  const message = error?.message || String(error);
  const stack = String(error?.stack || "")
    .split("\n")
    .slice(0, 6)
    .join("\n");
  return stack && !stack.includes(message) ? `${message}\n\n${stack}` : stack || message;
}

export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidMount() {
    showFatalError = (error) => this.setState({ error });
  }

  componentWillUnmount() {
    showFatalError = null;
  }

  componentDidCatch(error, info) {
    reportError(error, { componentStack: info?.componentStack });
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <View style={styles.root}>
        <Text style={styles.title}>A apărut o eroare</Text>
        <Text style={styles.subtitle}>
          Închide complet aplicația și deschide-o din nou. Dacă problema se repetă, trimite o
          captură a acestui ecran la suport.
        </Text>
        <ScrollView style={styles.box} contentContainerStyle={styles.boxContent}>
          <Text selectable style={styles.details}>
            {describe(error)}
          </Text>
        </ScrollView>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#f6f7f8",
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 40,
  },
  title: { fontSize: 22, fontWeight: "700", color: "#1c2b3a", marginBottom: 10 },
  subtitle: { fontSize: 14, lineHeight: 21, color: "#5b6a7a", marginBottom: 20 },
  box: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(32,47,62,0.18)",
    backgroundColor: "#ffffff",
  },
  boxContent: { padding: 14 },
  details: {
    fontSize: 12,
    lineHeight: 18,
    color: "#a8544c",
    fontFamily: Platform.select({ ios: "Courier", default: "monospace" }),
  },
});
