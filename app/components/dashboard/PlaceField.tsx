'use client';

// components/dashboard/PlaceField.tsx
// Address input with debounced search. Typing never leaves stale coordinates behind: editing the text
// clears the chosen place, so a price is only requested for an address the customer actually picked.
// The suggestion list and status messages are absolutely positioned, so nothing below the field jumps.

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import type { Place } from '@/lib/rydnow/config';
import { searchPlaces } from '@/lib/rydnow/geocode';
import { Icon, Spinner } from './ui';

interface Props {
  label: string;
  placeholder: string;
  value: Place | null;
  onChange: (place: Place | null) => void;
  trailing?: ReactNode;
  invalid?: boolean;
}

export default function PlaceField({ label, placeholder, value, onChange, trailing, invalid }: Props) {
  const id = useId();
  const [text, setText] = useState(value?.address ?? '');
  const [hits, setHits] = useState<Place[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const typing = useRef(false);

  // Parent set the place (use my location, saved place, rebook): show it. Parent cleared it: clear the text.
  useEffect(() => {
    if (value) setText(value.address);
    else if (!typing.current) setText('');
    typing.current = false;
  }, [value]);

  useEffect(() => {
    const q = text.trim();
    setNote('');
    if (value || q.length < 3) {
      setHits([]);
      setBusy(false);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        setBusy(true);
        const found = await searchPlaces(q, ctrl.signal);
        setHits(found);
        setNote(found.length ? '' : 'No match in Ghana. Try a nearby landmark or area name.');
        setOpen(true);
        setBusy(false);
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return;
        setHits([]);
        setNote('Address search is unavailable. Check your connection.');
        setOpen(true);
        setBusy(false);
      }
    }, 350);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [text, value]);

  return (
    <div className="relative min-w-0 flex-1">
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="text"
          role="combobox"
          aria-label={label}
          aria-invalid={invalid || undefined}
          aria-expanded={open}
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
          autoComplete="off"
          autoCorrect="off"
          enterKeyHint="search"
          placeholder={placeholder}
          value={text}
          className="w-full min-w-0 bg-transparent py-3 text-base font-medium text-gray-900 outline-none placeholder:font-normal placeholder:text-gray-400"
          onChange={(e) => {
            typing.current = true;
            setText(e.target.value);
            setOpen(true);
            if (value) onChange(null);
          }}
          onFocus={() => hits.length && setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
        />
        {busy && <Spinner />}
        {!busy && value && (
          <span className="shrink-0 text-green-600" title="Location confirmed">
            <Icon name="check" className="h-4 w-4" />
          </span>
        )}
        {!busy && text && (
          <button
            type="button"
            aria-label={`Clear ${label}`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              typing.current = true;
              setText('');
              setHits([]);
              onChange(null);
            }}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500"
          >
            <Icon name="close" className="h-3.5 w-3.5" />
          </button>
        )}
        {trailing}
      </div>

      {open && (hits.length > 0 || note) && (
        <ul
          id={`${id}-list`}
          role="listbox"
          className="absolute inset-x-0 top-full z-40 mt-1 max-h-64 overflow-y-auto overscroll-contain rounded-xl border border-gray-100 bg-white shadow-xl"
        >
          {hits.map((h) => {
            const [title, ...rest] = h.address.split(',');
            return (
              <li key={`${h.lat},${h.lng}`} role="option" aria-selected={false}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onChange(h);
                    setHits([]);
                    setOpen(false);
                  }}
                  className="flex w-full items-start gap-3 border-b border-gray-50 px-4 py-3 text-left last:border-b-0 active:bg-gray-50"
                >
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-100 text-sm">📍</span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-gray-900">{title}</span>
                    {rest.length > 0 && <span className="block truncate text-xs text-gray-500">{rest.join(',').trim()}</span>}
                  </span>
                </button>
              </li>
            );
          })}
          {hits.length === 0 && note && <li className="px-4 py-3 text-sm text-gray-500">{note}</li>}
        </ul>
      )}
    </div>
  );
}
