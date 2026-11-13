export type GuideBarId = 'GB1' | 'GB2' | 'GB3' | 'GB4' | 'GB5' | 'GB6';

export type LineStyle = 'solid' | 'dashed' | 'long-dash' | 'dotted' | 'dash-dot' | 'dash-dot-dot';

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
  opacity?: number; // 0.1 to 1.0 (Saydamlık)
  zIndex?: number; // 1 to 6 (Katman sırası, önde/arkada durması)
  lineStyle?: LineStyle; // Çizgi türü
}

export interface SafetyConfig {
  maxSafeShoggingJump: number; // Maximum allowed needle jump per course (default: 2-6 needles)
  maxAllowedNeedleNumber: number; // Maximum needle coordinate (e.g. 18)
  enableClashDetection: boolean; // Detect bar-to-bar collision or cross tension
  maxSafeRpm: number; // Machine speed warning threshold
  autoClampJumps: boolean; // Automatically clamp values exceeding safety
  warnOnEmptyNeedleKnitting: boolean; // Warn if yarn empty
}

export interface PatternWarning {
  id: string;
  courseIndex: number;
  gbId: GuideBarId;
  type: 'excessive_jump' | 'empty_needle' | 'clash' | 'out_of_bounds';
  message: string;
  severity: 'error' | 'warning';
  needle: number;
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
  stepIndex?: number; // 1, 2, 3, 4
  GB1: number;
  GB2: number;
  GB3: number;
  GB4: number;
  GB5: number;
  GB6: number;
  skips?: Partial<Record<GuideBarId, boolean>>; // true if course step is skipped/missed (atlama ipliği)
  notation?: string; // e.g. "9-10-9-10"
}

export interface RackTensionRow {
  id: string;
  courseCount: string; // "Kurs numarası" (ör. 29, 2)
  values: Partial<Record<GuideBarId, string>>; // Tarak başına rack tansiyon değeri (ör. 17500, 3000)
}

export interface PatternData {
  id: string;
  title: string;
  category: 'Halı & Zemin' | 'Bukle & Havlı' | 'Peluş / Kadife' | 'Rölyef & Jakar' | 'Otomotiv Halısı' | 'File / Ağ' | 'Geometrik' | 'Esnek / Spor' | 'Kadife / 3D' | 'Teknik';
  description: string;
  difficulty: 'Kolay' | 'Orta' | 'İleri';
  createdAt: string;
  rows: PatternRow[];
  guideBars: Record<GuideBarId, GuideBarConfig>;
  machine: MachineProfile;
  safety: SafetyConfig;
  repeatX: number;
  repeatY: number;
  authorId?: string;
  thumbnail?: string;
  updatedAt?: string;
  mayDensity?: string;
  rackTensionRows?: RackTensionRow[];
  isRackManualOverride?: boolean;
  rackNote?: string;
  tableExtras?: PatternTableExtrasData;
}

export interface CustomTableStepSnapshot {
  id: string;
  label?: string;
  values: Record<GuideBarId, number>;
  skippedBars?: Partial<Record<GuideBarId, boolean>>;
}

export interface LockedTableStepSnapshot {
  rowKey: string;
  courseIndex: number;
  sourceCourseIndex?: number;
  stepInCourse: 1 | 2 | 3 | 4;
  globalStepIndex: number;
  values: Record<GuideBarId, number>;
  sourceValues: Record<GuideBarId, number>;
  skippedBars: Partial<Record<GuideBarId, boolean>>;
  isInserted?: boolean;
}

export interface PatternTableExtrasData {
  isTableManualOverride?: boolean;
  lockedTableRows?: LockedTableStepSnapshot[];
  manualTableOverrides?: Record<string, number>;
  tableSkipOverrides?: Record<string, boolean>;
  deletedStepKeys?: string[];
  insertedStepsAfter?: Record<string, CustomTableStepSnapshot[]>;
}

export type ActiveTab = 'simulation' | 'editor' | 'library' | 'machine' | 'analysis' | 'table' | 'logs';

