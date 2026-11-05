import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Animated, Pressable, Text, View } from "react-native";
import { PIN_LENGTH, checkPin, clearPin, hasPin, savePin, verifyOwner } from "../pin";
import { useNow, useStore } from "../store";
import { useTheme } from "../theme";
import { Muted, Title } from "../ui";
import { Keypad } from "./Keypad";

type Step = "create" | "confirm" | "unlock";

const COPY: Record<Step, { title: string; hint: string }> = {
  create: { title: "Create a finance PIN", hint: "Choose 6 digits. Finance asks for them every time you open it." },
  confirm: { title: "Confirm your PIN", hint: "Enter the same 6 digits again." },
  unlock: { title: "Finance is locked", hint: "Enter your 6-digit PIN to see your money." },
};

export function PinScreen() {
  const t = useTheme();
  const { state, dispatch } = useStore();
  const now = useNow(1000);
  const [step, setStep] = useState<Step | null>(null);
  const [entry, setEntry] = useState("");
  const [firstPin, setFirstPin] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [shake] = useState(() => new Animated.Value(0));
  const lockedUntil = state.financeLock.lockedUntil;
  const lockedForMs = lockedUntil ? Math.max(0, lockedUntil - now.getTime()) : 0;
  const isLockedOut = lockedForMs > 0;

  useEffect(() => {
    hasPin()
      .then((exists) => setStep(exists ? "unlock" : "create"))
      .catch(() => setStep("create"));
  }, []);

  const reject = (text: string) => {
    setEntry("");
    setMessage(text);
    shake.setValue(0);
    Animated.sequence(
      [-12, 12, -8, 8, 0].map((toValue) => Animated.timing(shake, { toValue, duration: 70, useNativeDriver: true })),
    ).start();
  };

  const submit = async (pin: string) => {
    if (step === "create") {
      setFirstPin(pin);
      setEntry("");
      setMessage(null);
      setStep("confirm");
      return;
    }
    if (step === "confirm") {
      if (pin === firstPin) {
        await savePin(pin);
        dispatch({ type: "finance/unlock" });
        return;
      }
      setFirstPin("");
      setStep("create");
      reject("Those PINs did not match. Start again.");
      return;
    }
    if (await checkPin(pin)) {
      dispatch({ type: "finance/unlock" });
      return;
    }
    dispatch({ type: "finance/fail", now: Date.now() });
    reject("That PIN is not right.");
  };

  const press = (key: string) => {
    if (isLockedOut || busy) return;
    if (key === "back") {
      setEntry((current) => current.slice(0, -1));
      return;
    }
    if (!/^\d$/.test(key) || entry.length >= PIN_LENGTH) return;
    const next = entry + key;
    setEntry(next);
    if (next.length === PIN_LENGTH) {
      setBusy(true);
      submit(next)
        .catch(() => reject("Something went wrong. Try again."))
        .finally(() => setBusy(false));
    }
  };

  // Forgetting the PIN: the phone's own Face ID or passcode proves it's the owner.
  const forgot = async () => {
    const result = await verifyOwner("Confirm it's you to set a new finance PIN");
    if (result === "verified") {
      await clearPin();
      setEntry("");
      setFirstPin("");
      setMessage("Verified. Choose a new PIN.");
      setStep("create");
      return;
    }
    if (result === "failed") {
      setMessage("Couldn't confirm it's you.");
      return;
    }
    Alert.alert(
      "Can't verify you",
      "This phone has no Face ID, fingerprint or passcode, so the PIN can't be reset safely. You can erase your finance data and start again. Tasks are kept.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Erase finance",
          style: "destructive",
          onPress: async () => {
            await clearPin();
            dispatch({ type: "data/clear-finance", now: new Date() });
            setEntry("");
            setMessage(null);
            setStep("create");
          },
        },
      ],
    );
  };

  if (!step) {
    return (
      <View style={{ paddingVertical: 80, alignItems: "center" }}>
        <ActivityIndicator color={t.accent} />
      </View>
    );
  }

  const copy = COPY[step];
  const feedback = isLockedOut ? `Too many tries. Wait ${Math.ceil(lockedForMs / 1000)} s.` : message;

  return (
    <View style={{ alignItems: "center", gap: 22, paddingTop: 12 }}>
      <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: t.accent, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name="lock-closed" size={28} color="#FFFFFF" />
      </View>
      <View style={{ alignItems: "center", gap: 6 }}>
        <Title style={{ fontSize: 26, textAlign: "center" }}>{copy.title}</Title>
        <Muted style={{ textAlign: "center", fontSize: 14 }}>{copy.hint}</Muted>
      </View>
      <Animated.View
        accessibilityRole="text"
        accessibilityLabel={`${entry.length} of ${PIN_LENGTH} digits entered`}
        style={{ flexDirection: "row", gap: 16, transform: [{ translateX: shake }] }}
      >
        {Array.from({ length: PIN_LENGTH }, (_, index) => (
          <View
            key={index}
            style={{
              width: 14,
              height: 14,
              borderRadius: 7,
              backgroundColor: index < entry.length ? t.accent : "transparent",
              borderWidth: index < entry.length ? 0 : 1.5,
              borderColor: t.fg3,
            }}
          />
        ))}
      </Animated.View>
      <Text accessibilityLiveRegion="assertive" style={{ color: t.accent, fontSize: 14, minHeight: 20 }}>
        {feedback ?? ""}
      </Text>
      <Keypad
        onKey={press}
        disabled={isLockedOut}
        corner={
          step === "unlock" ? (
            <Pressable accessibilityRole="button" onPress={forgot} hitSlop={10}>
              <Text style={{ color: t.fg2, fontSize: 14 }}>Forgot?</Text>
            </Pressable>
          ) : null
        }
      />
    </View>
  );
}
