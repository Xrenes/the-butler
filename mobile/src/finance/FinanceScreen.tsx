import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { dayKeyOf, formatDayLabel, formatTime } from "@domain/dates";
import { LedgerError, computeBalances, makeCredit, makeDebit, sortNewestFirst } from "@domain/ledger";
import { formatMinor, parseAmount } from "@domain/money";
import type { FinanceCategory, Resource, Txn } from "@domain/types";
import { TIME_ZONE, newId, useStore } from "../store";
import { useTheme } from "../theme";
import { Card, Chip, CircleButton, type IconName, Muted, SectionTitle, Segmented, tap } from "../ui";
import { ResourceGlyph } from "./Keypad";
import { AccountSheet, AmountSheet, TransferSheet, groupDigits } from "./MoneySheets";
import { PinScreen } from "./PinScreen";

type Direction = "credit" | "debit";
type MoneySheet = { kind: "amount" } | { kind: "account"; resource: Resource | null } | { kind: "transfer" };

export const FINANCE_IDLE_MS = 60_000;
const FLASH_MS = 2_500;
const RECENT_LIMIT = 30;
const INCOME: readonly FinanceCategory[] = ["Salary", "Business", "Gift", "Savings", "Other"];
const EXPENSE: readonly FinanceCategory[] = ["Food", "Transport", "Bills", "Shopping", "Health", "Education", "Family", "Other"];
const DIRECTIONS = [
  { value: "debit", label: "Deduct" },
  { value: "credit", label: "Add" },
] as const;

/** Finance always opens locked; it locks again on leaving the tab, after a minute idle, or in the background. */
export function FinanceScreen({ onActivity }: { onActivity: () => void }) {
  const { state } = useStore();
  if (!state.financeUnlocked) return <PinScreen />;
  return (
    <View onTouchStart={onActivity}>
      <FinanceDashboard />
    </View>
  );
}

function FinanceDashboard() {
  const t = useTheme();
  const { state, dispatch } = useStore();
  const accounts = state.resources.filter((item) => !item.archived).sort((a, b) => a.order - b.order);
  const balances = computeBalances(state.resources, state.txns);
  const [sheet, setSheet] = useState<{ value: MoneySheet | null; nonce: number }>({ value: null, nonce: 0 });
  const [selectedId, setSelectedId] = useState(accounts[0]?.id ?? "");
  const [direction, setDirection] = useState<Direction>("debit");
  const [amountText, setAmountText] = useState("");
  const [category, setCategory] = useState<FinanceCategory>("Food");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selected = accounts.find((item) => item.id === selectedId) ?? accounts[0];
  const nameById = new Map(state.resources.map((item) => [item.id, item.name]));
  const open = (value: MoneySheet) => setSheet((current) => ({ value, nonce: current.nonce + 1 }));
  const close = () => setSheet((current) => ({ ...current, value: null }));

  useEffect(() => () => {
    if (flashTimer.current) clearTimeout(flashTimer.current);
  }, []);

  const changeDirection = (next: Direction) => {
    setDirection(next);
    setCategory(next === "credit" ? "Salary" : "Food");
    setError(null);
  };

  const commit = () => {
    if (!selected) return;
    const parsed = parseAmount(amountText);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    try {
      const meta = { id: newId(), now: new Date(), note };
      const input = { resourceId: selected.id, amount: parsed.minor, category };
      const context = { resources: state.resources, balances };
      const txn = direction === "credit" ? makeCredit(meta, input, context) : makeDebit(meta, input, context);
      dispatch({ type: "txn/add", txn });
      setAmountText("");
      setNote("");
      setError(null);
      setFlash(`${direction === "credit" ? "Added" : "Deducted"} ${formatMinor(parsed.minor)}`);
      if (flashTimer.current) clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => setFlash(null), FLASH_MS);
    } catch (problem) {
      setError(problem instanceof LedgerError ? problem.message : "Could not save that entry.");
    }
  };

  return (
    <View style={{ gap: 24 }}>
      <LinearGradient
        colors={["#0B0B0B", "#250A0B", "#561417", "#9C252A", "#D83036"]}
        start={{ x: 0, y: 0.2 }}
        end={{ x: 1, y: 0.8 }}
        style={{ borderRadius: 32, padding: 22, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" }}
      >
        <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 14 }}>Available balance</Text>
            <Text style={{ color: "#FFFFFF", fontSize: 40, fontWeight: "300", letterSpacing: -1, marginTop: 10 }} numberOfLines={1} adjustsFontSizeToFit>
              {formatMinor(balances.total)}
            </Text>
            <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, marginTop: 10 }}>{accounts.length} accounts</Text>
          </View>
          <CircleButton icon="lock-closed-outline" label="Lock finance" onPress={() => dispatch({ type: "finance/lock" })} />
        </View>
      </LinearGradient>

      <View>
        <SectionTitle
          action={
            <View style={{ flexDirection: "row", gap: 8 }}>
              {state.settings.transfersEnabled ? (
                <Chip icon="swap-horizontal" onPress={() => open({ kind: "transfer" })}>
                  Transfer
                </Chip>
              ) : null}
              <Chip icon="add" onPress={() => open({ kind: "account", resource: null })}>
                Add
              </Chip>
            </View>
          }
        >
          Accounts
        </SectionTitle>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingVertical: 2 }}>
          {accounts.map((account) => (
            <AccountCard
              key={account.id}
              account={account}
              balance={balances.byResource[account.id] ?? 0}
              selected={account.id === selected?.id}
              onSelect={() => setSelectedId(account.id)}
              onEdit={() => open({ kind: "account", resource: account })}
            />
          ))}
        </ScrollView>
      </View>

      <Card style={{ gap: 14 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Segmented options={DIRECTIONS} value={direction} onChange={changeDirection} />
          </View>
          <Text style={{ color: t.fg2, fontSize: 13 }}>
            {direction === "credit" ? "to" : "from"} <Text style={{ color: t.fg }}>{selected?.name ?? "—"}</Text>
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Amount"
          onPress={() => {
            tap();
            open({ kind: "amount" });
          }}
          style={{ backgroundColor: t.well, borderRadius: 22, borderWidth: 1, borderColor: t.edge, paddingHorizontal: 18, paddingVertical: 14 }}
        >
          <Text style={{ color: t.fg2, fontSize: 12 }}>Amount — tap to type</Text>
          <Text style={{ color: amountText ? t.fg : t.fg3, fontSize: 34, fontWeight: "300" }} numberOfLines={1}>
            ৳{groupDigits(amountText) || "0"}
          </Text>
        </Pressable>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {(direction === "credit" ? INCOME : EXPENSE).map((option) => (
            <Chip key={option} active={option === category} onPress={() => setCategory(option)}>
              {option}
            </Chip>
          ))}
        </ScrollView>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <TextInput
            value={note}
            onChangeText={setNote}
            maxLength={200}
            placeholder="Note (optional)"
            placeholderTextColor={t.fg3}
            selectionColor={t.accent}
            accessibilityLabel="Note"
            style={{ flex: 1, color: t.fg, backgroundColor: t.well, borderColor: t.edge, borderWidth: 1, borderRadius: 16, paddingHorizontal: 14, height: 50, fontSize: 15 }}
          />
          <CircleButton icon="checkmark" label="Save entry" variant="accent" size={52} disabled={!amountText} onPress={commit} />
        </View>
        {error ? <Text style={{ color: t.accent, fontSize: 14 }}>{error}</Text> : null}
        {flash ? <Text style={{ color: t.fg, fontSize: 14 }}>{flash}</Text> : null}
      </Card>

      <View>
        <SectionTitle action={<Muted style={{ fontSize: 12 }}>{state.txns.length} entries</Muted>}>Recent activity</SectionTitle>
        {state.txns.length === 0 ? (
          <Card>
            <Muted style={{ textAlign: "center" }}>No entries yet. Set a balance on an account, or add your first entry above.</Muted>
          </Card>
        ) : (
          <View style={{ gap: 8 }}>
            {sortNewestFirst(state.txns)
              .slice(0, RECENT_LIMIT)
              .map((txn) => (
                <TxnRow key={txn.id} txn={txn} nameById={nameById} />
              ))}
          </View>
        )}
      </View>

      <AmountSheet open={sheet.value?.kind === "amount"} value={amountText} onChange={setAmountText} onClose={close} />
      <AccountSheet
        open={sheet.value?.kind === "account"}
        resource={sheet.value?.kind === "account" ? sheet.value.resource : null}
        formKey={sheet.nonce}
        onClose={close}
      />
      <TransferSheet open={sheet.value?.kind === "transfer"} formKey={sheet.nonce} onClose={close} />
    </View>
  );
}

function AccountCard({
  account,
  balance,
  selected,
  onSelect,
  onEdit,
}: {
  account: Resource;
  balance: number;
  selected: boolean;
  onSelect: () => void;
  onEdit: () => void;
}) {
  const t = useTheme();
  return (
    <View style={{ width: 168, borderRadius: 24, borderWidth: 1.5, borderColor: selected ? t.accent : t.edge, backgroundColor: t.surface, padding: 14 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={account.name}
        accessibilityState={{ selected }}
        onPress={() => {
          tap();
          onSelect();
        }}
      >
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: t.surface2, alignItems: "center", justifyContent: "center" }}>
          <ResourceGlyph icon={account.icon} color={t.fg} />
        </View>
        <Text style={{ color: t.fg2, fontSize: 13, marginTop: 14 }}>{account.name}</Text>
        <Text style={{ color: t.fg, fontSize: 19, fontWeight: "500" }} numberOfLines={1} adjustsFontSizeToFit>
          {formatMinor(balance)}
        </Text>
      </Pressable>
      <View style={{ position: "absolute", top: 10, right: 10 }}>
        <CircleButton icon="pencil" label={`Edit ${account.name}`} size={32} onPress={onEdit} />
      </View>
    </View>
  );
}

interface TxnView {
  icon: IconName;
  title: string;
  detail: string;
  amount: string;
  tone: "in" | "out" | "neutral";
}

function describeTxn(txn: Txn, nameById: ReadonlyMap<string, string>): TxnView {
  const name = (id: string) => nameById.get(id) ?? "Account";
  switch (txn.type) {
    case "credit":
      return { icon: "add", title: txn.category, detail: `to ${name(txn.resourceId)}`, amount: `+${formatMinor(txn.amount)}`, tone: "in" };
    case "debit":
      return { icon: "remove", title: txn.category, detail: `from ${name(txn.resourceId)}`, amount: `−${formatMinor(txn.amount)}`, tone: "out" };
    case "adjustment":
      return {
        icon: "pencil",
        title: "Balance correction",
        detail: `${name(txn.resourceId)} · ${formatMinor(txn.previousBalance)} → ${formatMinor(txn.newBalance)}`,
        amount: formatMinor(txn.delta, { signed: true }),
        tone: txn.delta > 0 ? "in" : "out",
      };
    case "transfer":
      return { icon: "swap-horizontal", title: "Transfer", detail: `${name(txn.fromId)} → ${name(txn.toId)}`, amount: formatMinor(txn.amount), tone: "neutral" };
  }
}

function TxnRow({ txn, nameById }: { txn: Txn; nameById: ReadonlyMap<string, string> }) {
  const t = useTheme();
  const view = describeTxn(txn, nameById);
  const occurred = new Date(txn.occurredAt);
  const today = dayKeyOf(new Date(), TIME_ZONE);
  const when = `${formatDayLabel(dayKeyOf(occurred, TIME_ZONE), today)} · ${formatTime(occurred, TIME_ZONE)}`;
  const toneColor = view.tone === "out" ? t.accent : view.tone === "in" ? t.fg : t.fg2;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 10, borderRadius: 20, borderWidth: 1, borderColor: t.edge, backgroundColor: t.surface }}>
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: t.surface2, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name={view.icon} size={18} color={view.tone === "out" ? t.accent : t.fg} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: t.fg, fontSize: 14, fontWeight: "500" }} numberOfLines={1}>
          {view.title}
        </Text>
        <Text style={{ color: t.fg2, fontSize: 12 }} numberOfLines={1}>
          {view.detail}
          {txn.note ? ` · ${txn.note}` : ""}
        </Text>
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Text style={{ color: toneColor, fontSize: 14, fontWeight: "500" }}>{view.amount}</Text>
        <Text style={{ color: t.fg3, fontSize: 11 }}>{when}</Text>
      </View>
    </View>
  );
}
