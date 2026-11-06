import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, PanResponder, Text, View } from "react-native";
import { formatMinor } from "@domain/money";
import type { Resource } from "@domain/types";
import { useTheme } from "../theme";
import { CircleButton, tap, useScrollLock } from "../ui";
import { ResourceGlyph } from "./Keypad";

const CARD_HEIGHT = 196;
/** How far each card behind the front one peeks out below it. */
const PEEK = 20;
const MAX_BEHIND = 2;
const SWIPE_DISTANCE = 60;
const SWIPE_VELOCITY = 0.5;
const EXIT_MS = 170;
const TOTAL_GRADIENT = ["#0B0B0B", "#250A0B", "#561417", "#9C252A", "#D83036"] as const;
const ACCOUNT_GRADIENTS = [
  ["#2E2E2E", "#141414"],
  ["#3B1214", "#141414"],
  ["#262626", "#45161A"],
  ["#1E1E1E", "#5A1A1E"],
] as const;
const WHITE_70 = "rgba(255,255,255,0.7)";

interface BalanceStackProps {
  total: number;
  accounts: readonly Resource[];
  balances: Readonly<Record<string, number>>;
  /** 0 is the total card; 1..n are the accounts in order. */
  index: number;
  onIndex: (index: number) => void;
  onLock: () => void;
  onEdit: (account: Resource) => void;
}

/** Stack of balance cards: swipe up for the next card, down for the previous one. */
export function BalanceStack({ total, accounts, balances, index, onIndex, onLock, onEdit }: BalanceStackProps) {
  const t = useTheme();
  const setScrollLocked = useScrollLock();
  const [drag] = useState(() => new Animated.Value(0));
  const count = accounts.length + 1;
  const front = ((index % count) + count) % count;
  const latest = useRef({ front, count, onIndex });

  useEffect(() => {
    latest.current = { front, count, onIndex };
  });

  // The handlers read `latest` only while a finger is moving, never during render. Building the
  // responder once matters: rebuilding it mid-swipe (the page re-renders on scroll lock) would
  // reset the gesture.
  const swipe = useMemo(
    () =>
      // eslint-disable-next-line react-hooks/refs
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 6,
        onPanResponderGrant: () => {
          drag.stopAnimation();
          setScrollLocked(true);
        },
        onPanResponderMove: (_, gesture) => drag.setValue(gesture.dy),
        onPanResponderTerminationRequest: () => false,
        onPanResponderRelease: (_, gesture) => {
          setScrollLocked(false);
          const { front: current, count: cards, onIndex: change } = latest.current;
          const up = gesture.dy < -SWIPE_DISTANCE || gesture.vy < -SWIPE_VELOCITY;
          const down = gesture.dy > SWIPE_DISTANCE || gesture.vy > SWIPE_VELOCITY;
          if (cards < 2 || (!up && !down)) {
            Animated.spring(drag, { toValue: 0, useNativeDriver: true, bounciness: 6 }).start();
            return;
          }
          Animated.timing(drag, { toValue: up ? -CARD_HEIGHT : CARD_HEIGHT * 0.6, duration: EXIT_MS, useNativeDriver: true }).start(() => {
            tap();
            change((current + (up ? 1 : -1) + cards) % cards);
            // The next card is already in place underneath, so the stack settles exactly where it was.
            drag.setValue(0);
          });
        },
        onPanResponderTerminate: () => {
          setScrollLocked(false);
          Animated.spring(drag, { toValue: 0, useNativeDriver: true }).start();
        },
      }),
    [drag, setScrollLocked],
  );

  const depthOrder = Array.from({ length: Math.min(MAX_BEHIND, count - 1) + 1 }, (_, depth) => depth).reverse();

  return (
    <View style={{ gap: 10 }}>
      <View {...swipe.panHandlers} style={{ height: CARD_HEIGHT + MAX_BEHIND * PEEK }}>
        {depthOrder.map((depth) => {
          const position = (front + depth) % count;
          const account = position === 0 ? null : accounts[position - 1];
          const isFront = depth === 0;
          return (
            <Animated.View
              key={account?.id ?? "total"}
              pointerEvents={isFront ? "box-none" : "none"}
              style={{
                position: "absolute",
                top: MAX_BEHIND * PEEK,
                left: 0,
                right: 0,
                height: CARD_HEIGHT,
                opacity: 1 - depth * 0.22,
                // Cards behind peek out above the front card, like a wallet.
                transform: [{ translateY: isFront ? drag : -depth * PEEK }, { scale: 1 - depth * 0.05 }],
              }}
            >
              {account ? (
                <AccountFace account={account} balance={balances[account.id] ?? 0} tint={position - 1} onEdit={() => onEdit(account)} />
              ) : (
                <TotalFace total={total} accounts={accounts.length} onLock={onLock} />
              )}
            </Animated.View>
          );
        })}
      </View>
      <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6 }}>
        {Array.from({ length: count }, (_, dot) => (
          <View
            key={dot}
            style={{ width: dot === front ? 18 : 6, height: 6, borderRadius: 3, backgroundColor: dot === front ? t.accent : t.dotOff }}
          />
        ))}
      </View>
    </View>
  );
}

function TotalFace({ total, accounts, onLock }: { total: number; accounts: number; onLock: () => void }) {
  return (
    <LinearGradient
      colors={TOTAL_GRADIENT}
      start={{ x: 0, y: 0.2 }}
      end={{ x: 1, y: 0.8 }}
      style={{ flex: 1, borderRadius: 30, padding: 22, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" }}
    >
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: WHITE_70, fontSize: 14 }}>Available balance</Text>
          <Text style={{ color: "#FFFFFF", fontSize: 40, fontWeight: "300", letterSpacing: -1, marginTop: 8 }} numberOfLines={1} adjustsFontSizeToFit>
            {formatMinor(total)}
          </Text>
        </View>
        <CircleButton icon="lock-closed-outline" label="Lock finance" onPress={onLock} />
      </View>
      <View style={{ flex: 1 }} />
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={{ color: WHITE_70, fontSize: 13 }}>{accounts} accounts</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Ionicons name="chevron-up" size={14} color={WHITE_70} />
          <Text style={{ color: WHITE_70, fontSize: 12 }}>Swipe up for accounts</Text>
        </View>
      </View>
    </LinearGradient>
  );
}

function AccountFace({ account, balance, tint, onEdit }: { account: Resource; balance: number; tint: number; onEdit: () => void }) {
  return (
    <LinearGradient
      colors={ACCOUNT_GRADIENTS[tint % ACCOUNT_GRADIENTS.length]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ flex: 1, borderRadius: 30, padding: 22, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" }}>
            <ResourceGlyph icon={account.icon} size={22} color="#FFFFFF" />
          </View>
          <Text style={{ color: "#FFFFFF", fontSize: 18, fontWeight: "600" }}>{account.name}</Text>
        </View>
        <CircleButton icon="pencil" label={`Edit ${account.name}`} size={38} onPress={onEdit} />
      </View>
      <View style={{ flex: 1 }} />
      <Text style={{ color: WHITE_70, fontSize: 13 }}>Balance</Text>
      <Text style={{ color: "#FFFFFF", fontSize: 36, fontWeight: "300", letterSpacing: -1 }} numberOfLines={1} adjustsFontSizeToFit>
        {formatMinor(balance)}
      </Text>
    </LinearGradient>
  );
}
