export type GuideBarId = 'GB1' | 'GB2' | 'GB3' | 'GB4' | 'GB5' | 'GB6';

export interface GuideBarConfig {
  id: GuideBarId;
  name: string;
  active: boolean;
  color: string;
  yarnType: 'Elastan' | 'Polyester' | 'Naylon' | 'Pamuk' | 'Viskon';
  dtex: number;
  threading: string; // e.g. "Full", "1-in 1-out", "1-in 3-out"
  threadingArray: boolean[]; // exact needle-by-needle state (true = Dolu / In, false = Boş / Out) for 16 needles
  tension: number; // cN
}

export interface SafetyConfig {
  maxSafeShoggingJump: number; // Maximum allowed needle jump per course (default: 2 needles)
  maxAllowedNeedleNumber: number; // Maximum needle coordinate (e.g. 12)
  enableClashDetection: boolean; // Detect bar-to-bar collision or cross tension
  maxSafeRpm: number; // Machine speed warning threshold
  autoClampJumps: boolean; // Automatically clamp values exceeding safety
  warnOnEmptyNeedleKnitting: boolean; // Warn if loop formed without thread
}

export interface MachineProfile {
  brandModel: string;
  gauge: string; // e.g. "E22", "E28", "E32"
  workingWidthMm: number;
  workingWidthInch: number;
  maxGuideBars: number;
  powerKw: number;
  voltageV: number;
  coursesPerCm: number;
  walesPerCm: number;
  rpm: number;
  efficiency: number; // %
}

export interface PatternRow {
  id: string;
  courseIndex: number;
  GB1: number;
  GB2: number;
  GB3: number;
  GB4: number;
  GB5: number;
  GB6: number;
}

export interface PatternData {
  id: string;
  title: string;
  category: 'Halı & Zemin' | 'Bukle & Havlı' | 'Peluş / Kadife' | 'Rölyef & Jakar' | 'Otomotiv Halısı' | 'File / Ağ' | 'Geometrik' | 'Esnek / Spor' | 'Kadife / 3D' | 'Teknik';
  description: string;
  difficulty: 'Kolay' | 'Orta' | 'İleri';
  createdAt: string; // Kaydetme / Oluşturulma Tarihi (e.g. "02.11.2026 10:15")
  rows: PatternRow[];
  guideBars: Record<GuideBarId, GuideBarConfig>;
  machine: MachineProfile;
  safety: SafetyConfig;
  repeatX: number;
  repeatY: number;
}

export type ActiveTab = 'machine' | 'table' | 'editor' | 'simulation' | 'library';
