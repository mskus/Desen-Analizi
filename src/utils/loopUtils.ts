import { PatternRow, GuideBarConfig, GuideBarId, SafetyConfig, LoopWarning } from '../types';

export interface ParsedLoopCourse {
  courseNum: number;
  steps: number[];
  rawNotation: string;
}

/**
 * Parses chain loop notations such as:
 * "K1: 9-10-9-10 K2:10-9-10-9 K3:10-11-10-11 K4:11-10-11-10"
 * or "K1: 1-0/0-1" or simple comma/space separated numbers.
 */
export const parseLoopNotation = (text: string): ParsedLoopCourse[] => {
  if (!text || !text.trim()) return [];

  const results: ParsedLoopCourse[] = [];
  const trimmed = text.trim();

  // Case 1: Pattern contains explicit "K1:", "K2:" or "C1:", "C2:" tags
  const courseRegex = /(?:K|C|k|c)(\d+)\s*[:=]\s*([0-9\s\-,/.]+)/gi;
  let match: RegExpExecArray | null;
  let foundExplicit = false;

  while ((match = courseRegex.exec(trimmed)) !== null) {
    foundExplicit = true;
    const cNum = parseInt(match[1], 10);
    const rawVal = match[2].trim();
    const steps = rawVal
      .replace(/[/,]/g, '-')
      .split(/[\s-]+/)
      .map((s) => parseInt(s, 10))
      .filter((n) => !isNaN(n));

    if (steps.length > 0) {
      results.push({
        courseNum: cNum,
        steps,
        rawNotation: steps.join('-'),
      });
    }
  }

  if (foundExplicit && results.length > 0) {
    return results.sort((a, b) => a.courseNum - b.courseNum);
  }

  // Case 2: Multi-line or delimiter separated without explicit K labels
  // e.g. "9-10-9-10, 10-9-10-9" or lines
  const lines = trimmed.split(/[\n;]+/).map((l) => l.trim()).filter(Boolean);
  if (lines.length > 1) {
    lines.forEach((line, idx) => {
      const steps = line
        .replace(/[/,]/g, '-')
        .split(/[\s-]+/)
        .map((s) => parseInt(s, 10))
        .filter((n) => !isNaN(n));
      if (steps.length > 0) {
        results.push({
          courseNum: idx + 1,
          steps,
          rawNotation: steps.join('-'),
        });
      }
    });
    return results;
  }

  // Case 3: Space or comma separated single line e.g. "1-0 1-2 2-1" or "9-10-9-10"
  const tokens = trimmed.split(/[\s,]+/);
  tokens.forEach((token, idx) => {
    const steps = token
      .replace(/[/]/g, '-')
      .split('-')
      .map((s) => parseInt(s, 10))
      .filter((n) => !isNaN(n));

    if (steps.length > 0) {
      results.push({
        courseNum: idx + 1,
        steps,
        rawNotation: steps.join('-'),
      });
    }
  });

  return results;
};

/**
 * Ready-made loop templates including the user's specific carpet example
 */
export const LOOP_PRESETS = [
  {
    id: 'user_carpet',
    title: 'Halı Bukle İlmek (K1: 9-10-9-10, K2: 10-9-10-9...)',
    description: 'Kullanıcının talep ettiği 4 kurslu 4-adım ilmek zincir dizilimi',
    notation: 'K1: 9-10-9-10 K2: 10-9-10-9 K3: 10-11-10-11 K4: 11-10-11-10',
    category: 'Halı & Bukle',
  },
  {
    id: 'open_loop',
    title: 'Açık İlmek (Open Loop - 1-0 / 0-1)',
    description: 'Ters yönlü salınım, stabil ve elastik standart ilmek yapısı',
    notation: 'K1: 1-0 K2: 0-1 K3: 1-0 K4: 0-1',
    category: 'Standart',
  },
  {
    id: 'closed_loop',
    title: 'Kapalı İlmek (Closed Loop - 1-0 / 1-2)',
    description: 'Aynı yönlü salınım, sıkı ve dönmeyen kilit ilmek',
    notation: 'K1: 1-0 K2: 1-2 K3: 2-1 K4: 1-0',
    category: 'Kilit',
  },
  {
    id: 'carpet_pile_high',
    title: 'Yüksek Bukle Hav (9-11-9-11)',
    description: 'Geniş salınımlı yüksek havlı zemin dokusu',
    notation: 'K1: 9-11-9-11 K2: 11-9-11-9 K3: 10-12-10-12 K4: 12-10-12-10',
    category: 'Halı & Bukle',
  },
  {
    id: 'pillar_chain',
    title: 'Kilit Zincir (Pillar Stitch / Trikot)',
    description: 'Tek iğne sütununda dikey kilitlenme zinciri',
    notation: 'K1: 1-0 K2: 0-1 K3: 1-0 K4: 0-1',
    category: 'Zemin',
  },
  {
    id: 'atlas_zigzag',
    title: 'Atlas Zikzak İlmeği',
    description: 'Adım adım yana kayarak diagonel desen oluşturan ilmekler',
    notation: 'K1: 1-0 K2: 1-2 K3: 2-3 K4: 3-2 K5: 2-1 K6: 1-0',
    category: 'Geometrik',
  },
];

/**
 * Classifies an individual stitch movement
 */
export const classifyStitchLoop = (
  currentNeedle: number,
  prevNeedle: number,
  isThreaded: boolean,
  loopFormationRequired: boolean
): {
  type: 'open' | 'closed' | 'inlay' | 'dropped' | 'excessive';
  label: string;
  badgeColor: string;
} => {
  if (!isThreaded) {
    return {
      type: 'dropped',
      label: 'Düşen İlmek (İpliksiz İğne)',
      badgeColor: '#ef4444',
    };
  }

  const delta = currentNeedle - prevNeedle;

  if (Math.abs(delta) > 6) {
    return {
      type: 'excessive',
      label: 'Aşırı Atlama (>6)',
      badgeColor: '#f97316',
    };
  }

  if (delta === 0) {
    return {
      type: loopFormationRequired ? 'dropped' : 'inlay',
      label: loopFormationRequired ? 'Hatalı (İlmek Atılmadı)' : 'Atkı Serme (Inlay)',
      badgeColor: loopFormationRequired ? '#ef4444' : '#64748b',
    };
  }

  // Even / Odd direction check for open vs closed loop
  if (Math.abs(delta) % 2 === 1) {
    return {
      type: 'open',
      label: 'Açık İlmek (Open Loop)',
      badgeColor: '#10b981',
    };
  } else {
    return {
      type: 'closed',
      label: 'Kapalı İlmek (Closed Loop)',
      badgeColor: '#3b82f6',
    };
  }
};

/**
 * Complete Loop Validator: Inspects every course, guide bar, and needle movement.
 * Emits clear warnings if a wrong loop, dropped stitch, or collision occurs.
 */
export const validatePatternLoops = (
  rows: PatternRow[],
  guideBars: Record<GuideBarId, GuideBarConfig>,
  safety: SafetyConfig
): LoopWarning[] => {
  const warnings: LoopWarning[] = [];
  const activeGbIds = (Object.keys(guideBars) as GuideBarId[]).filter((id) => guideBars[id]?.active);

  rows.forEach((row, rIdx) => {
    const prevRow = rIdx > 0 ? rows[rIdx - 1] : rows[rows.length - 1];

    activeGbIds.forEach((gbId) => {
      const gb = guideBars[gbId];
      if (!gb) return;

      const targetNeedle = row[gbId] ?? 0;
      const prevNeedle = prevRow ? prevRow[gbId] ?? targetNeedle : targetNeedle;
      const jump = Math.abs(targetNeedle - prevNeedle);

      // 1. Out of Bounds Check
      if (targetNeedle < 0 || targetNeedle > safety.maxAllowedNeedleNumber) {
        warnings.push({
          id: `warn-oob-${rIdx}-${gbId}`,
          courseIndex: row.courseIndex,
          gbId,
          type: 'out_of_bounds',
          message: `K${row.courseIndex} ${gbId}: İğne ${targetNeedle} sınırların dışında (0-${safety.maxAllowedNeedleNumber})`,
          severity: 'error',
          needle: targetNeedle,
        });
      }

      // 2. Excessive Shogging Jump Check (İplik kopma & iğne kırılma)
      if (rIdx > 0 && jump > safety.maxSafeShoggingJump) {
        warnings.push({
          id: `warn-jump-${rIdx}-${gbId}`,
          courseIndex: row.courseIndex,
          gbId,
          type: 'excessive_jump',
          message: `K${row.courseIndex} ${gbId}: ${jump} iğne atlama yapıldı (Güvenli limit: ${safety.maxSafeShoggingJump} iğne, kopma riski)`,
          severity: 'warning',
          needle: targetNeedle,
        });
      }

      // 3. Threading check: Is there yarn on this needle guide?
      if (safety.warnOnEmptyNeedleKnitting && gb.threadingArray) {
        const isThreaded = gb.threadingArray[targetNeedle] === true;
        if (!isThreaded) {
          warnings.push({
            id: `warn-empty-${rIdx}-${gbId}`,
            courseIndex: row.courseIndex,
            gbId,
            type: 'empty_needle',
            message: `K${row.courseIndex} ${gbId}: İğne ${targetNeedle} boş (dizimde iplik yok), ilmek düşer!`,
            severity: 'error',
            needle: targetNeedle,
          });
        }
      }

      // 4. Loop Formation Required Check (İlmek Attırma Zorunlu Modu)
      if (safety.loopFormationRequired && rIdx > 0 && jump === 0) {
        warnings.push({
          id: `warn-noloop-${rIdx}-${gbId}`,
          courseIndex: row.courseIndex,
          gbId,
          type: 'no_overlap',
          message: `K${row.courseIndex} ${gbId}: İlmek atılmadı (Salınım sıfır, iplik iğneden kurtulur)`,
          severity: 'warning',
          needle: targetNeedle,
        });
      }
    });

    // 5. Clash Detection between Guide Bars
    if (safety.enableClashDetection && activeGbIds.length >= 2) {
      for (let i = 0; i < activeGbIds.length; i++) {
        for (let j = i + 1; j < activeGbIds.length; j++) {
          const gbA = activeGbIds[i];
          const gbB = activeGbIds[j];
          const needleA = row[gbA] ?? 0;
          const needleB = row[gbB] ?? 0;

          if (needleA === needleB && rIdx > 0) {
            const prevA = prevRow[gbA] ?? needleA;
            const prevB = prevRow[gbB] ?? needleB;
            const dirA = Math.sign(needleA - prevA);
            const dirB = Math.sign(needleB - prevB);

            // Crossing opposite directions into the exact same needle
            if (dirA !== 0 && dirB !== 0 && dirA !== dirB) {
              warnings.push({
                id: `warn-clash-${rIdx}-${gbA}-${gbB}`,
                courseIndex: row.courseIndex,
                gbId: gbA,
                type: 'clash',
                message: `K${row.courseIndex}: ${gbA} ve ${gbB} zıt yönden İğne ${needleA}'ya çarpışma riski taşıyor!`,
                severity: 'warning',
                needle: needleA,
              });
            }
          }
        }
      }
    }
  });

  return warnings;
};
