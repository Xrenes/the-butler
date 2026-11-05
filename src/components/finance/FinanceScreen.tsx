"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { newId } from "@/components/demo/seed";
import { TIME_ZONE, useDemo } from "@/components/demo/store";
import { Icon, type IconName } from "@/components/icons/Icon";
import { CountUp } from "@/components/ui/charts";
import { useOverlay } from "@/components/ui/Sheet";
import {
  Card,
  ChipButton,
  CircleButton,
  FIELD,
  SectionTitle,
  Segmented,
} from "@/components/ui/primitives";
import { dayKeyOf, formatDayLabel, formatTime } from "@/lib/domain/dates";
import { LedgerError, computeBalances, makeCredit, makeDebit, sortNewestFirst } from "@/lib/domain/ledger";
import { formatMinor, parseAmount } from "@/lib/domain/money";
import type { FinanceCategory, Resource, Txn } from "@/lib/domain/types";
import { AccountSheet, AmountSheet, TransferSheet, groupDigits } from "./MoneySheets";
import { PinScreen } from "./PinScreen";

type Direction = "credit" | "debit";
type MoneySheet = { kind: "amount" } | { kind: "account"; resource: Resource | null } | { kind: "transfer" };

const AUTO_LOCK_MS = 60_000;
const FLASH_MS = 2_500;
const RECENT_LIMIT = 30;
const ACTIVITY_EVENTS = ["pointerdown", "keydown", "wheel", "touchstart"] as const;
const INCOME: readonly FinanceCategory[] = ["Salary", "Business", "Gift", "Savings", "Other"];
const EXPENSE: readonly FinanceCategory[] = ["Food", "Transport", "Bills", "Shopping", "Health", "Education", "Family", "Other"];
const DIRECTIONS = [
  { value: "credit", label: "Add", icon: "plus" },
  { value: "debit", label: "Deduct", icon: "minus" },
] as const;

/** Finance always opens locked; it locks again on leaving, on idle, or when the app is hidden. */
export function FinanceScreen() {
  const { state } = useDemo();
  if (!state.finance.unlocked) return <PinScreen key={state.finance.pin ? "unlock" : "create"} />;
  return <FinanceDashboard />;
}

function useAutoLock() {
  const { dispatch } = useDemo();
  useEffect(() => {
    const lock = () => dispatch({ type: "pin/lock" });
    let timer = window.setTimeout(lock, AUTO_LOCK_MS);
    const restart = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(lock, AUTO_LOCK_MS);
    };
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") lock();
    };
    ACTIVITY_EVENTS.forEach((name) => window.addEventListener(name, restart, { passive: true }));
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.clearTimeout(timer);
      ACTIVITY_EVENTS.forEach((name) => window.removeEventListener(name, restart));
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [dispatch]);
}

function FinanceDashboard() {
  const { state, dispatch } = useDemo();
  useAutoLock();
  const accounts = state.resources.filter((item) => !item.archived).sort((a, b) => a.order - b.order);
  const balances = computeBalances(state.resources, state.txns);
  const sheets = useOverlay<MoneySheet>();
  const [selectedId, setSelectedId] = useState(accounts[0]?.id ?? "");
  const [direction, setDirection] = useState<Direction>("debit");
  const [amountText, setAmountText] = useState("");
  const [category, setCategory] = useState<FinanceCategory>("Food");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const selected = accounts.find((item) => item.id === selectedId) ?? accounts[0];
  const sheet = sheets.overlay;
  const nameById = new Map(state.resources.map((item) => [item.id, item.name]));

  useEffect(() => {
    if (!flash) return;
    const id = window.setTimeout(() => setFlash(null), FLASH_MS);
    return () => window.clearTimeout(id);
  }, [flash]);

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
    } catch (problem) {
      setError(problem instanceof LedgerError ? problem.message : "Could not save that entry.");
    }
  };

  return (
    <div className="grid grid-cols-1 gap-[clamp(16px,2.4vw,28px)] lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      <div className="min-w-0 space-y-[clamp(16px,2.4vw,28px)]">
        <div className="relative pt-7">
          {/* Cards peeking out from behind, like the reference's card stack. */}
          <span aria-hidden className="surface-raised absolute inset-x-[10%] top-0 h-24 rounded-[32px] opacity-40" />
          <span aria-hidden className="surface-raised absolute inset-x-[5%] top-3.5 h-24 rounded-[32px] opacity-70" />
          <section className="ribbed relative isolate overflow-hidden rounded-[32px] bg-brand-gradient p-[clamp(20px,4vw,32px)] text-white shadow-[0_22px_40px_-22px_var(--accent-glow)] ring-1 ring-white/10">
            <span aria-hidden className="pointer-events-none absolute -top-24 -left-16 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
            <div className="relative z-10 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm text-white/70">Available balance</p>
                <p className="text-display mt-3 truncate">
                  <CountUp value={balances.total} format={formatMinor} />
                </p>
                <p className="mt-3 text-sm text-white/70">{accounts.length} accounts · updated just now</p>
              </div>
              <CircleButton icon="lock" label="Lock finance" variant="glass" onClick={() => dispatch({ type: "pin/lock" })} />
            </div>
          </section>
        </div>

        <section>
          <SectionTitle
            action={
              <div className="flex gap-2">
                {state.settings.transfersEnabled ? (
                  <ChipButton icon="transfer" onClick={() => sheets.open({ kind: "transfer" })}>
                    Transfer
                  </ChipButton>
                ) : null}
                <ChipButton icon="plus" onClick={() => sheets.open({ kind: "account", resource: null })}>
                  Add
                </ChipButton>
              </div>
            }
          >
            Accounts
          </SectionTitle>
          <div className="no-scrollbar -mx-[clamp(16px,4.5vw,48px)] flex snap-x gap-3 overflow-x-auto px-[clamp(16px,4.5vw,48px)] md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0">
            {accounts.map((account) => (
              <AccountCard
                key={account.id}
                account={account}
                balance={balances.byResource[account.id] ?? 0}
                selected={account.id === selected?.id}
                onSelect={() => setSelectedId(account.id)}
                onEdit={() => sheets.open({ kind: "account", resource: account })}
              />
            ))}
          </div>
        </section>

        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Segmented label="Entry type" options={DIRECTIONS} value={direction} onChange={changeDirection} />
            <span className="text-sm text-fg-2">
              {direction === "credit" ? "to" : "from"} <span className="text-fg">{selected?.name ?? "—"}</span>
            </span>
          </div>
          <button
            type="button"
            onClick={() => sheets.open({ kind: "amount" })}
            className="surface-well mt-4 block w-full rounded-3xl border border-[var(--card-edge)] px-5 py-4 text-left transition-[filter] hover:brightness-125"
          >
            <span className="block text-xs text-fg-2">Amount — tap to type</span>
            <span className={`text-display-sm block truncate ${amountText ? "text-fg" : "text-fg-3"}`}>
              ৳{groupDigits(amountText) || "0"}
            </span>
          </button>
          <div className="no-scrollbar -mx-[clamp(16px,3.2vw,26px)] mt-4 flex gap-2 overflow-x-auto px-[clamp(16px,3.2vw,26px)]">
            {(direction === "credit" ? INCOME : EXPENSE).map((option) => (
              <ChipButton key={option} active={option === category} onClick={() => setCategory(option)}>
                {option}
              </ChipButton>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-3">
            <input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={200}
              placeholder="Note (optional)"
              aria-label="Note"
              className={FIELD}
            />
            <CircleButton icon="check" label="Save entry" variant="accent" size="lg" disabled={!amountText} onClick={commit} />
          </div>
          {error ? (
            <p role="alert" className="mt-3 text-sm text-accent">
              {error}
            </p>
          ) : null}
          <AnimatePresence>
            {flash ? (
              <motion.p
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-3 text-sm text-fg"
                role="status"
              >
                {flash}
              </motion.p>
            ) : null}
          </AnimatePresence>
        </Card>
      </div>

      <section className="min-w-0 lg:sticky lg:top-6 lg:self-start">
        <SectionTitle action={<span className="text-xs text-fg-3">{state.txns.length} entries</span>}>
          Recent activity
        </SectionTitle>
        <ul className="space-y-2">
          <AnimatePresence initial={false}>
            {sortNewestFirst(state.txns)
              .slice(0, RECENT_LIMIT)
              .map((txn) => (
                <TxnRow key={txn.id} txn={txn} nameById={nameById} />
              ))}
          </AnimatePresence>
        </ul>
      </section>

      <AmountSheet
        open={sheet?.open === true && sheet.value.kind === "amount"}
        value={amountText}
        onChange={setAmountText}
        onClose={sheets.close}
      />
      <AccountSheet
        open={sheet?.open === true && sheet.value.kind === "account"}
        resource={sheet?.value.kind === "account" ? sheet.value.resource : null}
        formKey={sheet?.nonce ?? 0}
        onClose={sheets.close}
      />
      <TransferSheet
        open={sheet?.open === true && sheet.value.kind === "transfer"}
        formKey={sheet?.nonce ?? 0}
        onClose={sheets.close}
      />
    </div>
  );
}

interface AccountCardProps {
  account: Resource;
  balance: number;
  selected: boolean;
  onSelect: () => void;
  onEdit: () => void;
}

function AccountCard({ account, balance, selected, onSelect, onEdit }: AccountCardProps) {
  return (
    <div
      className={`surface-card relative min-w-[clamp(150px,44vw,220px)] snap-start rounded-3xl p-4 ring-[1.5px] transition-shadow md:min-w-0 ${
        selected ? "shadow-[0_0_26px_-8px_var(--accent-glow)] ring-accent" : "ring-transparent"
      }`}
    >
      <button type="button" aria-pressed={selected} onClick={onSelect} className="block w-full text-left">
        <span className="surface-raised grid h-10 w-10 place-items-center rounded-full">
          <Icon name={account.icon} size={20} />
        </span>
        <span className="mt-4 block text-sm text-fg-2">{account.name}</span>
        <span className="block truncate text-xl font-medium tabular-nums">{formatMinor(balance)}</span>
      </button>
      <CircleButton
        icon="pencil"
        label={`Edit ${account.name}`}
        size="sm"
        variant="ghost"
        className="absolute top-3 right-3"
        onClick={onEdit}
      />
    </div>
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
      return { icon: "plus", title: txn.category, detail: `to ${name(txn.resourceId)}`, amount: `+${formatMinor(txn.amount)}`, tone: "in" };
    case "debit":
      return { icon: "minus", title: txn.category, detail: `from ${name(txn.resourceId)}`, amount: `−${formatMinor(txn.amount)}`, tone: "out" };
    case "adjustment":
      return {
        icon: "pencil",
        title: "Balance correction",
        detail: `${name(txn.resourceId)} · ${formatMinor(txn.previousBalance)} → ${formatMinor(txn.newBalance)}`,
        amount: formatMinor(txn.delta, { signed: true }),
        tone: txn.delta > 0 ? "in" : "out",
      };
    case "transfer":
      return { icon: "transfer", title: "Transfer", detail: `${name(txn.fromId)} → ${name(txn.toId)}`, amount: formatMinor(txn.amount), tone: "neutral" };
  }
}

const TONE_CLASS: Record<TxnView["tone"], string> = { in: "text-fg", out: "text-accent", neutral: "text-fg-2" };

function TxnRow({ txn, nameById }: { txn: Txn; nameById: ReadonlyMap<string, string> }) {
  const view = describeTxn(txn, nameById);
  const occurred = new Date(txn.occurredAt);
  const today = dayKeyOf(new Date(), TIME_ZONE);
  const when = `${formatDayLabel(dayKeyOf(occurred, TIME_ZONE), today)} · ${formatTime(occurred, TIME_ZONE)}`;
  return (
    <motion.li
      layout
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      className="surface-card flex items-center gap-3 rounded-[20px] px-3 py-2.5"
    >
      <span
        className={`surface-raised grid h-10 w-10 shrink-0 place-items-center rounded-full ${view.tone === "out" ? "text-accent" : "text-fg"}`}
      >
        <Icon name={view.icon} size={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{view.title}</span>
        <span className="block truncate text-xs text-fg-2">
          {view.detail}
          {txn.note ? ` · ${txn.note}` : ""}
        </span>
      </span>
      <span className="text-right">
        <span className={`block text-sm font-medium tabular-nums ${TONE_CLASS[view.tone]}`}>{view.amount}</span>
        <span className="block text-[11px] text-fg-3">{when}</span>
      </span>
    </motion.li>
  );
}
