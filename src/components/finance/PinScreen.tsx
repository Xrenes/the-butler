"use client";

import { type ReactNode, useEffect, useState } from "react";
import { motion } from "motion/react";
import { useDemo, useNow } from "@/components/demo/store";
import { Icon } from "@/components/icons/Icon";

const PIN_LENGTH = 6;
const DIGITS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"] as const;
const KEY_CLASS =
  "mx-auto grid aspect-square w-[clamp(60px,18vw,76px)] place-items-center rounded-full bg-surface text-[clamp(1.4rem,1.2rem+1vw,1.75rem)] font-light transition-colors hover:bg-surface-2 disabled:opacity-40";

type Step = "create" | "confirm" | "unlock";

const COPY: Record<Step, { title: string; hint: string }> = {
  create: { title: "Create a finance PIN", hint: "Choose 6 digits. Finance asks for them every time you open it." },
  confirm: { title: "Confirm your PIN", hint: "Enter the same 6 digits again." },
  unlock: { title: "Finance is locked", hint: "Enter your 6-digit PIN to see your money." },
};

interface KeypadProps {
  onKey: (key: string) => void;
  allowDecimal?: boolean;
  disabled?: boolean;
  corner?: ReactNode;
}

/** Round on-screen keypad shared by the PIN lock and the amount entry. */
export function Keypad({ onKey, allowDecimal = false, disabled = false, corner }: KeypadProps) {
  const key = (value: string, label: ReactNode, ariaLabel?: string, extra = "") => (
    <motion.button
      key={value}
      type="button"
      whileTap={disabled ? undefined : { scale: 0.9 }}
      disabled={disabled}
      aria-label={ariaLabel}
      onClick={() => onKey(value)}
      className={`${KEY_CLASS} ${extra}`}
    >
      {label}
    </motion.button>
  );
  return (
    <div className="mx-auto grid w-full max-w-[19rem] grid-cols-3 gap-[clamp(10px,3vw,16px)]">
      {DIGITS.map((digit) => key(digit, digit))}
      {allowDecimal ? key(".", ".", "Decimal point") : <div className="grid place-items-center">{corner}</div>}
      {key("0", "0")}
      {key("back", <Icon name="backspace" size={24} />, "Delete", "bg-transparent hover:bg-surface")}
    </div>
  );
}

export function PinScreen() {
  const { state, dispatch } = useDemo();
  const now = useNow(1000);
  const [step, setStep] = useState<Step>(state.finance.pin ? "unlock" : "create");
  const [entry, setEntry] = useState("");
  const [firstPin, setFirstPin] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [shakes, setShakes] = useState(0);
  const [showForgot, setShowForgot] = useState(false);
  const lockedForMs = state.finance.lockedUntil ? Math.max(0, state.finance.lockedUntil - now.getTime()) : 0;
  const isLockedOut = lockedForMs > 0;

  const reject = (text: string) => {
    setEntry("");
    setMessage(text);
    setShakes((count) => count + 1);
  };

  const submit = (pin: string) => {
    if (step === "create") {
      setFirstPin(pin);
      setEntry("");
      setMessage(null);
      setStep("confirm");
      return;
    }
    if (step === "confirm") {
      if (pin === firstPin) {
        dispatch({ type: "pin/set", pin });
        return;
      }
      setFirstPin("");
      setStep("create");
      reject("Those PINs did not match. Start again.");
      return;
    }
    if (pin === state.finance.pin) {
      dispatch({ type: "pin/unlock" });
      return;
    }
    dispatch({ type: "pin/fail", now: Date.now() });
    reject("That PIN is not right.");
  };

  const press = (key: string) => {
    if (isLockedOut) return;
    if (key === "back") {
      setEntry((current) => current.slice(0, -1));
      return;
    }
    if (!/^\d$/.test(key) || entry.length >= PIN_LENGTH) return;
    const next = entry + key;
    setEntry(next);
    if (next.length === PIN_LENGTH) submit(next);
  };

  // Physical keyboards: digits and Backspace. Re-subscribes each render to see the latest entry.
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (/^\d$/.test(event.key)) press(event.key);
      else if (event.key === "Backspace") press("back");
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  });

  const copy = COPY[step];
  const feedback = isLockedOut ? `Too many tries. Wait ${Math.ceil(lockedForMs / 1000)} s.` : message;

  return (
    <section className="mx-auto flex max-w-md flex-col items-center gap-[clamp(18px,3.2vh,30px)] py-[clamp(8px,3vh,32px)] text-center">
      <span className="grid h-16 w-16 place-items-center rounded-full bg-accent text-white shadow-[0_12px_32px_-8px_rgba(216,48,54,0.7)]">
        <Icon name="lock" size={28} />
      </span>
      <div className="space-y-2">
        <h1 className="text-title">{copy.title}</h1>
        <p className="text-sm text-fg-2">{copy.hint}</p>
      </div>
      <motion.div
        key={shakes}
        animate={shakes > 0 ? { x: [0, -12, 12, -8, 8, 0] } : { x: 0 }}
        transition={{ duration: 0.42 }}
        className="flex gap-4"
        role="status"
        aria-label={`${entry.length} of ${PIN_LENGTH} digits entered`}
      >
        {Array.from({ length: PIN_LENGTH }, (_, index) => (
          <motion.span
            key={index}
            animate={{ scale: index < entry.length ? 1.15 : 1 }}
            className={`h-3.5 w-3.5 rounded-full ${
              index < entry.length ? "bg-accent" : "border-[1.5px] border-dark-grey"
            }`}
          />
        ))}
      </motion.div>
      <p aria-live="assertive" className="min-h-5 text-sm text-accent">
        {feedback}
      </p>
      <Keypad
        onKey={press}
        disabled={isLockedOut}
        corner={
          step === "unlock" ? (
            <button
              type="button"
              className="text-sm text-fg-2 underline-offset-4 hover:text-fg hover:underline"
              onClick={() => setShowForgot((open) => !open)}
            >
              Forgot?
            </button>
          ) : null
        }
      />
      {showForgot ? (
        <div className="rounded-3xl bg-surface p-4 text-left text-sm text-fg-2">
          In the full app you confirm your account password to set a new PIN. In this demo you can reset it
          directly.
          <button
            type="button"
            className="mt-3 block font-medium text-fg underline underline-offset-4"
            onClick={() => dispatch({ type: "pin/reset" })}
          >
            Reset demo PIN
          </button>
        </div>
      ) : null}
      <p className="text-xs text-fg-3">Demo: the PIN only lives in this browser tab.</p>
    </section>
  );
}
