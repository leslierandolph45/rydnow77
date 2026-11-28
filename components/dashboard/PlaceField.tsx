'use client';


import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import type { Place } from '@/lib/rydnow/config';
import { searchPlaces } from '@/lib/rydnow/geocode';


interface PlaceFieldProps {
  label: string;
  placeholder?: string;
  value: Place | null;
  onChange: (place: Place | null) => void;
  /** Extra control on the right, e.g. the "use my location" button. */
  trailing?: ReactNode;
  invalid?: boolean;
}


const MIN_CHARS = 3;
const DEBOUNCE_MS = 300;


/** Address input with live suggestions. `value` is only set once the customer picks a suggestion. */
export default function PlaceField({ label, placeholder, value, onChange, trailing, invalid }: PlaceFieldProps) {
  const id = useId();
  const [text, setText] = useState(value?.address ?? '');
  const [results, setResults] = useState<Place[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [failed, setFailed] = useState(false);
  const focused = useRef(false);
  const requestId = useRef(0);


  // Follow outside changes (location button, saved places, rebook). Don't wipe what the customer is typing.
  useEffect(() => {
    if (value) setText(value.address);
    else if (!focused.current) setText('');
  }, [value]);


  // Debounced search.
  useEffect(() => {
    const q = text.trim();
    if (!open || q.length < MIN_CHARS || (value && value.address === text)) {
      setResults([]);
      setSearching(false);
      return;
    }


    const req = ++requestId.current;
    setSearching(true);
    setFailed(false);
    const timer = setTimeout(async () => {
      try {
        const found = await searchPlaces(q);
        if (req !== requestId.current) return;
        setResults(found.slice(0, 5));
      } catch {
        if (req !== requestId.current) return;
        setResults([]);
        setFailed(true);
      } finally {
        if (req === requestId.current) setSearching(false);
      }
    }, DEBOUNCE_MS);


    return () => clearTimeout(timer);
  }, [text, open, value]);


  const pick = (place: Place) => {
    setText(place.address);
    setResults([]);
    setOpen(false);
    onChange(place);
  };


  const showList = open && text.trim().length >= MIN_CHARS && !(value && value.address === text);


  return (
    <div className="relative">
      <label htmlFor={id} className="block pt-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="text"
          value={text}
          placeholder={placeholder}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          aria-invalid={invalid || undefined}
          aria-expanded={showList}
          aria-autocomplete="list"
          onFocus={() => {
            focused.current = true;
            setOpen(true);
          }}
          onBlur={() => {
            focused.current = false;
            setOpen(false);
          }}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
            if (value) onChange(null); // editing invalidates the picked place
          }}
          className={`min-w-0 flex-1 bg-transparent py-2.5 text-[15px] font-medium text-gray-900 placeholder:font-normal placeholder:text-gray-400 focus:outline-none ${invalid ? 'text-red-600' : ''}`}
        />
        {text && (
          <button
            type="button"
            aria-label={`Clear ${label.toLowerCase()}`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setText('');
              setResults([]);
              if (value) onChange(null);
            }}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-gray-400 active:bg-gray-100"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        )}
        {trailing}
      </div>


      {showList && (
        <ul role="listbox" aria-label={`${label} suggestions`} className="absolute inset-x-0 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-xl border border-gray-100 bg-white py-1 shadow-xl">
          {searching && results.length === 0 && <li className="px-4 py-3 text-sm text-gray-500">Searching…</li>}
          {!searching && failed && <li className="px-4 py-3 text-sm text-red-600">Search is unavailable right now. Try again.</li>}
          {!searching && !failed && results.length === 0 && <li className="px-4 py-3 text-sm text-gray-500">No matches. Try a nearby landmark or area.</li>}
          {results.map((p) => (
            <li key={`${p.lat},${p.lng},${p.address}`} role="option" aria-selected={false}>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(p)} className="flex w-full items-start gap-3 px-4 py-3 text-left active:bg-gray-50">
                <span className="mt-0.5 text-gray-400" aria-hidden>
                  📍
                </span>
                <span className="text-sm text-gray-900">{p.address}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}


