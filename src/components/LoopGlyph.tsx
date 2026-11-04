import React from 'react';
import { LoopType } from '../utils/loopEngine';

interface LoopGlyphProps {
  type: LoopType;
  direction?: 'left' | 'right' | 'straight';
  showBadgeText?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const LoopGlyph: React.FC<LoopGlyphProps> = React.memo(({
  type,
  direction = 'straight',
  showBadgeText = true,
  size = 'md',
}) => {
  const isSmall = size === 'sm';
  const iconSize = isSmall ? 'w-3.5 h-3.5' : size === 'lg' ? 'w-5 h-5' : 'w-4 h-4';

  const badgeConfig = {
    open: {
      letter: 'O',
      title: 'Açık İlmek (Open Loop)',
      color: 'text-blue-400',
      bg: 'bg-blue-950/70',
      border: 'border-blue-500/50',
    },
    closed: {
      letter: 'C',
      title: 'Kapalı İlmek (Closed Loop)',
      color: 'text-emerald-400',
      bg: 'bg-emerald-950/70',
      border: 'border-emerald-500/50',
    },
    miss: {
      letter: 'M',
      title: 'Atlama / Yüzer (Miss / Float)',
      color: 'text-slate-400',
      bg: 'bg-slate-900',
      border: 'border-slate-700/60',
    },
    tuck: {
      letter: 'T',
      title: 'Yükleme / Doku (Tuck)',
      color: 'text-amber-400',
      bg: 'bg-amber-950/70',
      border: 'border-amber-500/50',
    },
  };

  const cfg = badgeConfig[type];

  return (
    <div
      className={`inline-flex items-center space-x-1 px-1.5 py-0.5 rounded-md border text-[10px] font-mono font-bold transition-all select-none ${cfg.bg} ${cfg.color} ${cfg.border}`}
      title={cfg.title}
    >
      {/* SVG Loop Glyph Icon */}
      <svg
        className={`${iconSize} shrink-0 stroke-current fill-none`}
        viewBox="0 0 24 24"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {type === 'open' && (
          // Open loop arch
          <>
            <path d="M6 18 V10 C6 6, 18 6, 18 10 V18" />
            {direction === 'left' && <path d="M18 18 L14 21" />}
            {direction === 'right' && <path d="M6 18 L10 21" />}
          </>
        )}

        {type === 'closed' && (
          // Crossed legs closed loop
          <>
            <path d="M8 18 L16 8 C16 4, 8 4, 8 8 L16 18" />
          </>
        )}

        {type === 'miss' && (
          // Float dashed line
          <>
            <line x1="3" y1="12" x2="21" y2="12" strokeDasharray="3 3" />
            <polygon points="18,9 21,12 18,15" fill="currentColor" stroke="none" />
          </>
        )}

        {type === 'tuck' && (
          // Double arch tuck loop
          <>
            <path d="M4 18 C4 10, 12 10, 12 18" />
            <path d="M12 18 C12 8, 20 8, 20 18" />
          </>
        )}
      </svg>

      {showBadgeText && (
        <span className="leading-none text-[10px] tracking-tight">{cfg.letter}</span>
      )}
    </div>
  );
});
