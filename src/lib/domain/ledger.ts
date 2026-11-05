/**
 * Append-only ledger. Balances are never stored; they are recomputed from transactions.
 * A balance correction is an `adjustment` entry and a transfer is ONE record holding both legs,
 * so it cannot be half-applied.
 */
import { formatMinor } from "./money";
import { type FinanceCategory, MAX_MINOR, type Resource, type Txn } from "./types";

export type LedgerErrorCode =
  | "invalid_amount"
  | "insufficient_funds"
  | "same_resource"
  | "unknown_resource"
  | "negative_balance"
  | "no_change";

export class LedgerError extends Error {
  constructor(
    readonly code: LedgerErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "LedgerError";
  }
}

export interface Balances {
  byResource: Readonly<Record<string, number>>;
  total: number;
}

export interface LedgerContext {
  resources: readonly Resource[];
  balances: Balances;
}

export interface TxnMeta {
  id: string;
  now: Date;
  note?: string;
}

interface MoneyInput {
  resourceId: string;
  amount: number;
  category: FinanceCategory;
}

const MAX_NOTE_LENGTH = 200;

export function txnEffects(txn: Txn): ReadonlyArray<readonly [string, number]> {
  switch (txn.type) {
    case "credit":
      return [[txn.resourceId, txn.amount]];
    case "debit":
      return [[txn.resourceId, -txn.amount]];
    case "adjustment":
      return [[txn.resourceId, txn.delta]];
    case "transfer":
      return [
        [txn.fromId, -txn.amount],
        [txn.toId, txn.amount],
      ];
  }
}

export function computeBalances(resources: readonly Resource[], txns: readonly Txn[]): Balances {
  const byResource: Record<string, number> = Object.fromEntries(
    resources.map((resource) => [resource.id, 0]),
  );
  for (const txn of txns) {
    for (const [resourceId, delta] of txnEffects(txn)) {
      if (resourceId in byResource) byResource[resourceId] += delta;
    }
  }
  const total = Object.values(byResource).reduce((sum, value) => sum + value, 0);
  return { byResource, total };
}

export function sortNewestFirst(txns: readonly Txn[]): Txn[] {
  return [...txns].sort(
    (a, b) => b.occurredAt.localeCompare(a.occurredAt) || b.createdAt.localeCompare(a.createdAt),
  );
}

function requireResource(context: LedgerContext, resourceId: string): Resource {
  const resource = context.resources.find((item) => item.id === resourceId && !item.archived);
  if (!resource) throw new LedgerError("unknown_resource", "Choose where the money is.");
  return resource;
}

function requireAmount(amount: number): void {
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount > MAX_MINOR) {
    throw new LedgerError("invalid_amount", "Enter an amount above zero.");
  }
}

function requireFunds(context: LedgerContext, resource: Resource, amount: number): void {
  const available = context.balances.byResource[resource.id] ?? 0;
  if (amount > available) {
    throw new LedgerError(
      "insufficient_funds",
      `Only ${formatMinor(available)} available in ${resource.name}.`,
    );
  }
}

function baseFields(meta: TxnMeta) {
  const stamp = meta.now.toISOString();
  return {
    kind: "txn" as const,
    id: meta.id,
    note: (meta.note ?? "").trim().slice(0, MAX_NOTE_LENGTH),
    occurredAt: stamp,
    createdAt: stamp,
  };
}

export function makeCredit(meta: TxnMeta, input: MoneyInput, context: LedgerContext): Txn {
  requireAmount(input.amount);
  requireResource(context, input.resourceId);
  return { ...baseFields(meta), type: "credit", ...input };
}

export function makeDebit(meta: TxnMeta, input: MoneyInput, context: LedgerContext): Txn {
  requireAmount(input.amount);
  requireFunds(context, requireResource(context, input.resourceId), input.amount);
  return { ...baseFields(meta), type: "debit", ...input };
}

export function makeAdjustment(
  meta: TxnMeta,
  input: { resourceId: string; newBalance: number },
  context: LedgerContext,
): Txn {
  requireResource(context, input.resourceId);
  if (!Number.isSafeInteger(input.newBalance) || input.newBalance < 0) {
    throw new LedgerError("negative_balance", "A balance cannot be negative.");
  }
  if (input.newBalance > MAX_MINOR) {
    throw new LedgerError("invalid_amount", "That amount is too large.");
  }
  const previousBalance = context.balances.byResource[input.resourceId] ?? 0;
  const delta = input.newBalance - previousBalance;
  if (delta === 0) throw new LedgerError("no_change", "The balance is already that amount.");
  return {
    ...baseFields(meta),
    type: "adjustment",
    resourceId: input.resourceId,
    delta,
    previousBalance,
    newBalance: input.newBalance,
  };
}

export function makeTransfer(
  meta: TxnMeta,
  input: { fromId: string; toId: string; amount: number },
  context: LedgerContext,
): Txn {
  requireAmount(input.amount);
  if (input.fromId === input.toId) {
    throw new LedgerError("same_resource", "Pick two different places to move money between.");
  }
  const from = requireResource(context, input.fromId);
  requireResource(context, input.toId);
  requireFunds(context, from, input.amount);
  return { ...baseFields(meta), type: "transfer", ...input };
}

/** Effect of a transaction on the total balance: transfers are neutral. */
export function totalEffect(txn: Txn): number {
  return txnEffects(txn).reduce((sum, [, delta]) => sum + delta, 0);
}
