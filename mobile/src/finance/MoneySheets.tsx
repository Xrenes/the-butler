import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { LedgerError, computeBalances, makeAdjustment, makeTransfer } from "@domain/ledger";
import { applyKeypadKey, minorToInput, parseAmount } from "@domain/money";
import { RESOURCE_ICONS, type Resource, type ResourceIcon, type Txn } from "@domain/types";
import { newId, useStore } from "../store";
import { useTheme } from "../theme";
import { Chip, GhostButton, PrimaryButton, Sheet, tap } from "../ui";
import { Keypad, ResourceGlyph } from "./Keypad";

const MAX_NAME_LENGTH = 24;
const grouping = new Intl.NumberFormat("en-IN");

/** Keypad text with lakh grouping, e.g. "123456.5" -> "1,23,456.5". */
export function groupDigits(text: string): string {
  if (!text) return "";
  const [whole, fraction] = text.split(".");
  const grouped = grouping.format(Number(whole || "0"));
  return fraction === undefined ? grouped : `${grouped}.${fraction}`;
}

/** Balance input: empty means "unchanged", zero is allowed. */
function parseBalance(text: string): number | null | "invalid" {
  const cleaned = text.replace(/[,\s৳]/g, "");
  if (cleaned === "") return null;
  if (/^0+(\.0{1,2})?$/.test(cleaned)) return 0;
  const parsed = parseAmount(cleaned);
  return parsed.ok ? parsed.minor : "invalid";
}

const describeError = (problem: unknown, fallback: string) => (problem instanceof LedgerError ? problem.message : fallback);

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const t = useTheme();
  return (
    <View>
      <Text style={{ color: t.fg2, fontSize: 12, marginBottom: 8 }}>{label}</Text>
      {children}
    </View>
  );
}

function useFieldStyle() {
  const t = useTheme();
  return {
    color: t.fg,
    backgroundColor: t.well,
    borderColor: t.edge,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    height: 50,
    fontSize: 16,
  } as const;
}

export function AmountSheet({ open, value, onChange, onClose }: { open: boolean; value: string; onChange: (value: string) => void; onClose: () => void }) {
  const t = useTheme();
  return (
    <Sheet open={open} title="Amount" onClose={onClose}>
      <View style={{ gap: 22 }}>
        <Text style={{ color: value ? t.fg : t.fg3, fontSize: 44, fontWeight: "300", textAlign: "center" }}>৳{groupDigits(value) || "0"}</Text>
        <Keypad allowDecimal onKey={(key) => onChange(applyKeypadKey(value, key))} />
        <View style={{ flexDirection: "row" }}>
          <PrimaryButton onPress={onClose}>Done</PrimaryButton>
        </View>
      </View>
    </Sheet>
  );
}

export function AccountSheet({ open, resource, formKey, onClose }: { open: boolean; resource: Resource | null; formKey: number; onClose: () => void }) {
  return (
    <Sheet open={open} title={resource ? `Edit ${resource.name}` : "New account"} onClose={onClose}>
      <AccountForm key={formKey} resource={resource} onClose={onClose} />
    </Sheet>
  );
}

function AccountForm({ resource, onClose }: { resource: Resource | null; onClose: () => void }) {
  const t = useTheme();
  const field = useFieldStyle();
  const { state, dispatch } = useStore();
  const balances = computeBalances(state.resources, state.txns);
  const currentBalance = resource ? (balances.byResource[resource.id] ?? 0) : 0;
  const [name, setName] = useState(resource?.name ?? "");
  const [icon, setIcon] = useState<ResourceIcon>(resource?.icon ?? "wallet");
  const [balanceText, setBalanceText] = useState(resource ? minorToInput(currentBalance) : "");
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    const trimmed = name.trim();
    if (!trimmed || trimmed.length > MAX_NAME_LENGTH) {
      setError(`Give the account a name (up to ${MAX_NAME_LENGTH} characters).`);
      return;
    }
    const newBalance = parseBalance(balanceText);
    if (newBalance === "invalid") {
      setError("Use numbers with up to 2 decimals.");
      return;
    }
    const now = new Date();
    const record: Resource = resource
      ? { ...resource, name: trimmed, icon }
      : { kind: "resource", id: newId(), name: trimmed, icon, order: state.resources.length, archived: false, createdAt: now.toISOString() };
    const resources = resource ? state.resources.map((item) => (item.id === record.id ? record : item)) : [...state.resources, record];

    let adjustment: Txn | null = null;
    if (newBalance !== null && newBalance !== currentBalance) {
      try {
        adjustment = makeAdjustment(
          { id: newId(), now, note: resource ? "Balance correction" : "Opening balance" },
          { resourceId: record.id, newBalance },
          { resources, balances: computeBalances(resources, state.txns) },
        );
      } catch (problem) {
        setError(describeError(problem, "Could not update the balance."));
        return;
      }
    }
    dispatch({ type: "resource/save", resource: record });
    if (adjustment) dispatch({ type: "txn/add", txn: adjustment });
    onClose();
  };

  return (
    <View style={{ gap: 18 }}>
      <Field label="Name">
        <TextInput value={name} onChangeText={setName} maxLength={MAX_NAME_LENGTH} selectionColor={t.accent} style={field} />
      </Field>
      <Field label="Icon">
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          {RESOURCE_ICONS.map((option) => {
            const active = option === icon;
            return (
              <Pressable
                key={option}
                accessibilityRole="button"
                accessibilityLabel={option}
                accessibilityState={{ selected: active }}
                onPress={() => {
                  tap();
                  setIcon(option);
                }}
                style={{
                  width: 50,
                  height: 50,
                  borderRadius: 25,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: active ? t.accent : t.surface,
                  borderWidth: 1,
                  borderColor: active ? t.accent : t.edge,
                }}
              >
                <ResourceGlyph icon={option} size={22} color={active ? "#FFFFFF" : t.fg2} />
              </Pressable>
            );
          })}
        </View>
      </Field>
      <Field label="Balance (৳)">
        <TextInput
          value={balanceText}
          onChangeText={setBalanceText}
          keyboardType="decimal-pad"
          placeholder="0"
          placeholderTextColor={t.fg3}
          selectionColor={t.accent}
          style={[field, { fontSize: 18 }]}
        />
        <Text style={{ color: t.fg3, fontSize: 12, marginTop: 8 }}>Changing the balance records a correction in your history. Nothing is overwritten.</Text>
      </Field>
      {error ? <Text style={{ color: t.accent, fontSize: 14 }}>{error}</Text> : null}
      <View style={{ flexDirection: "row", gap: 12 }}>
        <GhostButton onPress={onClose}>Cancel</GhostButton>
        <PrimaryButton onPress={save}>{resource ? "Save" : "Add account"}</PrimaryButton>
      </View>
    </View>
  );
}

export function TransferSheet({ open, formKey, onClose }: { open: boolean; formKey: number; onClose: () => void }) {
  return (
    <Sheet open={open} title="Transfer" onClose={onClose}>
      <TransferForm key={formKey} onClose={onClose} />
    </Sheet>
  );
}

function TransferForm({ onClose }: { onClose: () => void }) {
  const t = useTheme();
  const field = useFieldStyle();
  const { state, dispatch } = useStore();
  const accounts = state.resources.filter((item) => !item.archived).sort((a, b) => a.order - b.order);
  const [fromId, setFromId] = useState(accounts[0]?.id ?? "");
  const [toId, setToId] = useState(accounts[1]?.id ?? "");
  const [amountText, setAmountText] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    const parsed = parseAmount(amountText);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    try {
      const txn = makeTransfer(
        { id: newId(), now: new Date(), note },
        { fromId, toId, amount: parsed.minor },
        { resources: state.resources, balances: computeBalances(state.resources, state.txns) },
      );
      dispatch({ type: "txn/add", txn });
      onClose();
    } catch (problem) {
      setError(describeError(problem, "Could not move the money."));
    }
  };

  const picker = (label: string, value: string, onPick: (id: string) => void) => (
    <Field label={label}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {accounts.map((account) => (
          <Chip key={account.id} active={account.id === value} onPress={() => onPick(account.id)}>
            {account.name}
          </Chip>
        ))}
      </View>
    </Field>
  );

  return (
    <View style={{ gap: 18 }}>
      {picker("From", fromId, setFromId)}
      {picker("To", toId, setToId)}
      <Field label="Amount (৳)">
        <TextInput
          value={amountText}
          onChangeText={setAmountText}
          keyboardType="decimal-pad"
          placeholder="0"
          placeholderTextColor={t.fg3}
          selectionColor={t.accent}
          accessibilityLabel="Transfer amount"
          style={[field, { fontSize: 18 }]}
        />
      </Field>
      <TextInput
        value={note}
        onChangeText={setNote}
        maxLength={200}
        placeholder="Note (optional)"
        placeholderTextColor={t.fg3}
        selectionColor={t.accent}
        accessibilityLabel="Note"
        style={field}
      />
      <Text style={{ color: t.fg3, fontSize: 12 }}>A transfer moves money between your accounts. Your total stays the same.</Text>
      {error ? <Text style={{ color: t.accent, fontSize: 14 }}>{error}</Text> : null}
      <View style={{ flexDirection: "row", gap: 12 }}>
        <GhostButton onPress={onClose}>Cancel</GhostButton>
        <PrimaryButton onPress={save}>Move money</PrimaryButton>
      </View>
    </View>
  );
}
