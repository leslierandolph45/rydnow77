"use client";

// components/booking/AddressField.tsx
// Typing never leaves stale coordinates behind: editing the text clears the chosen place,
// so a price can only be requested for an address the customer actually picked.

import { useEffect, useId, useRef, useState } from "react";
import type { Place } from "@/lib/rydnow/config";
import { currentPosition, reversePlace, searchPlaces } from "@/lib/rydnow/geocode";
import styles from "./booking.module.css";

interface Props {
  label: string;
  value: Place | null;
  onChange: (place: Place | null) => void;
  placeholder?: string;
  allowLocate?: boolean;
  invalid?: boolean;
}

export default function AddressField({ label, value, onChange, placeholder, allowLocate, invalid }: Props) {
  const id = useId();
  const [text, setText] = useState(value?.address ?? "");
  const [hits, setHits] = useState<Place[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);

  // Keep the text in sync when the parent sets the place (e.g. "Use my location").
  useEffect(() => {
    if (value) setText(value.address);
  }, [value]);

  // Debounced search.
  useEffect(() => {
    const q = text.trim();
    if (value || q.length < 3) {
      setHits([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        setBusy(true);
        const found = await searchPlaces(q, ctrl.signal);
        setHits(found);
        setOpen(true);
        setNote(found.length ? "" : "No match in Ghana. Try a nearby landmark or area name.");
      } catch (e) {
        if (!(e instanceof DOMException && e.name === "AbortError")) {
          setNote("Address search is unavailable. Check your connection.");
        }
      } finally {
        setBusy(false);
      }
    }, 350);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [text, value]);

  // Close the list when clicking elsewhere.
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  async function locate() {
    setNote("");
    setBusy(true);
    try {
      const pos = await currentPosition();
      const place = await reversePlace(pos.lat, pos.lng);
      onChange(place);
      setOpen(false);
    } catch (e) {
      const denied = typeof e === "object" && e !== null && "code" in e && (e as { code: number }).code === 1;
      setNote(
        denied
          ? "Location is turned off for this site. Type your address instead."
          : "We couldn't find your location. Type your address instead.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.field} ref={boxRef}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      <div className={styles.inputRow}>
        <input
          id={id}
          className={styles.input}
          value={text}
          placeholder={placeholder ?? "Search a street, area or landmark"}
          autoComplete="off"
          aria-invalid={invalid || undefined}
          aria-expanded={open}
          aria-controls={`${id}-list`}
          onChange={(e) => {
            setText(e.target.value);
            if (value) onChange(null);
          }}
          onFocus={() => hits.length && setOpen(true)}
          onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
        />
        {allowLocate && (
          <button type="button" className={styles.btnGhost} onClick={locate} disabled={busy}>
            Use my location
          </button>
        )}
      </div>
      {open && hits.length > 0 && (
        <ul className={styles.suggestions} id={`${id}-list`} role="listbox">
          {hits.map((h) => (
            <li key={`${h.lat},${h.lng}`}>
              <button
                type="button"
                className={styles.suggestion}
                onClick={() => {
                  onChange(h);
                  setOpen(false);
                }}
              >
                {h.address}
              </button>
            </li>
          ))}
        </ul>
      )}
      {value ? (
        <span className={styles.chosen}>Location confirmed</span>
      ) : (
        text.trim().length >= 3 &&
        !busy && <span className={styles.muted}>{note || "Pick one of the suggestions to confirm the location."}</span>
      )}
    </div>
  );
}


