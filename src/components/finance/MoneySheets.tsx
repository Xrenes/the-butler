"use client";

import { useEffect, useState } from "react";
import { newId } from "@/components/demo/seed";
import { useDemo } from "@/components/demo/store";
import { Icon } from "@/components/icons/Icon";
import { Sheet } from "@/components/ui/Sheet";
import { ChipButton, FIELD, GhostButton, PrimaryButton } from "@/components/ui/primitives";
import { LedgerError, computeBalances, makeAdjustment, makeTransfer } from "@/lib/domain/ledger";
import { applyKeypadKey, minorToInput, parseAmount } from "@/lib/domain/money";
import { RESOURCE_ICONS, type Resource, type ResourceIcon, type Txn } from "@/lib/domain/types";
import { Keypad } from "./PinScreen";

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

function describeError(problem: unknown, fallback: string): string {
  return problem instanceof LedgerError ? problem.message : fallback;
}

interface AmountSheetProps {
  open: boolean;
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
}

export function AmountSheet({ open, value, onChange, onClose }: AmountSheetProps) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Enter") {
        onClose();
        return;
      }
      const key = event.key === "Backspace" ? "back" : event.key;
      if (/^[\d.]$/.test(key) || key === "back") {
        event.preventDefault();
        onChange(applyKeypadKey(value, key));
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, value, onChange, onClose]);

  return (
    <Sheet open={open} title="Amount" onClose={onClose}>
      <div className="space-y-6 pb-2">
        <p className={`text-display text-center ${value ? "" : "text-fg-3"}`}>৳{groupDigits(value) || "0"}</p>
        <Keypad allowDecimal onKey={(key) => onChange(applyKeypadKey(value, key))} />
        <div className="flex">
          <PrimaryButton onClick={onClose}>Done</PrimaryButton>
        </div>
      </div>
    </Sheet>
  );
}

interface AccountSheetProps {
  open: boolean;
  resource: Resource | null;
  formKey: number;
  onClose: () => void;
}

export function AccountSheet({ open, resource, formKey, onClose }: AccountSheetProps) {
  return (
    <Sheet open={open} title={resource ? `Edit ${resource.name}` : "New account"} onClose={onClose}>
      <AccountForm key={formKey} resource={resource} onClose={onClose} />
    </Sheet>
  );
}

function AccountForm({ resource, onClose }: { resource: Resource | null; onClose: () => void }) {
  const { state, dispatch } = useDemo();
  const balances = computeBalances(state.resources, state.txns);
  const currentBalance = resource ? (balances.byResource[resource.id] ?? 0) : 0;
  const [name, setName] = useState(resource?.name ?? "");
  const [icon, setIcon] = useState<ResourceIcon>(resource?.icon ?? "wallet");
  const [balanceText, setBalanceText] = useState(resource ? minorToInput(currentBalance) : "");
  const [error, setError] = useState<string | null>(null);

  const handleSave = () => {
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
      : {
          kind: "resource",
          id: newId(),
          name: trimmed,
          icon,
          order: state.resources.length,
          archived: false,
          createdAt: now.toISOString(),
        };
    const resources = resource
      ? state.resources.map((item) => (item.id === record.id ? record : item))
      : [...state.resources, record];

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
    <div className="space-y-5 pb-2">
      <label className="block">
        <span className="mb-2 block text-xs text-fg-2">Name</span>
        <input value={name} onChange={(event) => setName(event.target.value)} maxLength={MAX_NAME_LENGTH} className={FIELD} />
      </label>
      <fieldset>
        <legend className="mb-2 text-xs text-fg-2">Icon</legend>
        <div className="flex flex-wrap gap-2">
          {RESOURCE_ICONS.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={option === icon}
              aria-label={option}
              onClick={() => setIcon(option)}
              className={`grid h-12 w-12 place-items-center rounded-full transition-colors ${
                option === icon ? "accent-fill" : "surface-card text-fg-2 hover:text-fg"
              }`}
            >
              <Icon name={option} size={22} />
            </button>
          ))}
        </div>
      </fieldset>
      <label className="block">
        <span className="mb-2 block text-xs text-fg-2">Balance (৳)</span>
        <input
          value={balanceText}
          onChange={(event) => setBalanceText(event.target.value)}
          inputMode="decimal"
          placeholder="0"
          className={`${FIELD} text-lg tabular-nums`}
        />
        <span className="mt-2 block text-xs text-fg-3">
          Changing the balance records a correction in your history. Nothing is overwritten.
        </span>
      </label>
      {error ? (
        <p role="alert" className="text-sm text-accent">
          {error}
        </p>
      ) : null}
      <div className="flex gap-3">
        <GhostButton onClick={onClose}>Cancel</GhostButton>
        <PrimaryButton onClick={handleSave}>{resource ? "Save" : "Add account"}</PrimaryButton>
      </div>
    </div>
  );
}

interface TransferSheetProps {
  open: boolean;
  formKey: number;
  onClose: () => void;
}

export function TransferSheet({ open, formKey, onClose }: TransferSheetProps) {
  return (
    <Sheet open={open} title="Transfer" onClose={onClose}>
      <TransferForm key={formKey} onClose={onClose} />
    </Sheet>
  );
}

function TransferForm({ onClose }: { onClose: () => void }) {
  const { state, dispatch } = useDemo();
  const accounts = state.resources.filter((item) => !item.archived).sort((a, b) => a.order - b.order);
  const [fromId, setFromId] = useState(accounts[0]?.id ?? "");
  const [toId, setToId] = useState(accounts[1]?.id ?? "");
  const [amountText, setAmountText] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSave = () => {
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
    <fieldset>
      <legend className="mb-2 text-xs text-fg-2">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {accounts.map((account) => (
          <ChipButton key={account.id} icon={account.icon} active={account.id === value} onClick={() => onPick(account.id)}>
            {account.name}
          </ChipButton>
        ))}
      </div>
    </fieldset>
  );

  return (
    <div className="space-y-5 pb-2">
      {picker("From", fromId, setFromId)}
      {picker("To", toId, setToId)}
      <label className="block">
        <span className="mb-2 block text-xs text-fg-2">Amount (৳)</span>
        <input
          value={amountText}
          onChange={(event) => setAmountText(event.target.value)}
          inputMode="decimal"
          placeholder="0"
          className={`${FIELD} text-lg tabular-nums`}
        />
      </label>
      <input
        value={note}
        onChange={(event) => setNote(event.target.value)}
        maxLength={200}
        placeholder="Note (optional)"
        aria-label="Note"
        className={FIELD}
      />
      <p className="text-xs text-fg-3">A transfer moves money between your accounts. Your total stays the same.</p>
      {error ? (
        <p role="alert" className="text-sm text-accent">
          {error}
        </p>
      ) : null}
      <div className="flex gap-3">
        <GhostButton onClick={onClose}>Cancel</GhostButton>
        <PrimaryButton onClick={handleSave}>Move money</PrimaryButton>
      </div>
    </div>
  );
}
