import React, { useEffect, useRef, useState } from 'react';
import { MoreHorizontal } from 'lucide-react';

export interface MoreMenuItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
}

interface MoreMenuProps {
  items: MoreMenuItem[];
  ariaLabel: string;
  dark?: boolean; // زر على خلفية داكنة (الشريط العلوي)
}

// زر «⋯» يفتح قائمة؛ تُغلق بالضغط خارجها وبـEscape وبعد اختيار عنصر
export const MoreMenu: React.FC<MoreMenuProps> = ({ items, ariaLabel, dark }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        title={ariaLabel}
        className={`p-2 rounded-xl border transition cursor-pointer ${
          dark
            ? 'bg-slate-900 hover:bg-slate-800 text-slate-200 border-slate-800'
            : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300'
        }`}
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>
      {open && (
        <div role="menu" className="absolute left-0 top-full mt-1 min-w-[190px] bg-white text-slate-800 border border-slate-200 rounded-xl shadow-xl py-1 z-50">
          {items.map(it => (
            <button
              key={it.label}
              type="button"
              role="menuitem"
              disabled={it.disabled}
              title={it.title}
              onClick={() => { setOpen(false); it.onClick(); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-right hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              {it.icon}
              <span>{it.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
