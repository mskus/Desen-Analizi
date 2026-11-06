// Persistent user preferences helper for Simulation & Editor tabs

export const PREF_KEYS = {
  // Simulation Tab
  SIM_ZOOM: 'warpknitt_pref_sim_zoom',
  SIM_DISPLAY_MODE: 'warpknitt_pref_sim_display_mode',
  SIM_PAPER_THEME: 'warpknitt_pref_sim_paper_theme',
  SIM_REPEAT_Y: 'warpknitt_pref_sim_repeat_y',
  SIM_COURSE_PITCH: 'warpknitt_pref_sim_course_pitch',
  SIM_SHOW_STEP_NUMBERS: 'warpknitt_pref_sim_show_step_numbers',
  SIM_SHOW_PORE_MESH: 'warpknitt_pref_sim_show_pore_mesh',
  SIM_ISOLATE_BAR: 'warpknitt_pref_sim_isolate_bar',
  SIM_EDITING_GB: 'warpknitt_pref_sim_editing_gb',

  // Interactive Editor Tab
  EDITOR_ZOOM: 'warpknitt_pref_editor_zoom',
  EDITOR_ACTIVE_GB: 'warpknitt_pref_editor_active_gb',
  EDITOR_LIVE_PREVIEW: 'warpknitt_pref_editor_live_preview',
  EDITOR_LIVE_FABRIC: 'warpknitt_pref_editor_live_fabric',
  EDITOR_AUTO_EXPAND_COURSES: 'warpknitt_pref_editor_auto_expand_courses',
} as const;

export function getStoredPreference<T>(key: string, defaultValue: T): T {
  try {
    const item = localStorage.getItem(key);
    if (item === null) return defaultValue;
    return JSON.parse(item) as T;
  } catch (e) {
    console.warn(`Error reading preference for key "${key}":`, e);
    return defaultValue;
  }
}

export function setStoredPreference<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn(`Error writing preference for key "${key}":`, e);
  }
}
