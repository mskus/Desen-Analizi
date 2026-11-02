import React from 'react';
import { MachineProfile, GuideBarConfig, GuideBarId } from '../types';
import { ShieldCheck } from 'lucide-react';

interface MachineSettingsTabProps {
  machine: MachineProfile;
  onChangeMachine: (updated: MachineProfile) => void;
  guideBars: Record<GuideBarId, GuideBarConfig>;
  onChangeGuideBar: (id: GuideBarId, updated: GuideBarConfig) => void;
  onOpenSafetySettings?: () => void;
}

export const MachineSettingsTab: React.FC<MachineSettingsTabProps> = ({
  machine,
  onChangeMachine,
  guideBars,
  onChangeGuideBar,
  onOpenSafetySettings,
}) => {
  const handleMachineChange = (field: keyof MachineProfile, value: any) => {
    onChangeMachine({
      ...machine,
      [field]: value,
    });
  };

  const handleGbChange = (id: GuideBarId, field: keyof GuideBarConfig, value: any) => {
    onChangeGuideBar(id, {
      ...guideBars[id],
      [field]: value,
    });
  };

  const coursePerMeter = machine.coursesPerCm * 100;
  const prodMeterPerHour = ((machine.rpm * 60 * (machine.efficiency / 100)) / coursePerMeter).toFixed(1);

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 space-y-3">
      {/* 1. Machine Model & Specs */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 sm:p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-white tracking-tight">{machine.brandModel}</h2>
            <div className="text-xs text-slate-400 mt-0.5">
              <span>{machine.gauge}</span>
              <span className="mx-1.5 text-slate-600">·</span>
              <span>{machine.workingWidthMm} mm ({machine.workingWidthInch}&quot;)</span>
              <span className="mx-1.5 text-slate-600">·</span>
              <span>{machine.powerKw} kW / {machine.voltageV}V</span>
            </div>
          </div>

          <div className="flex items-center space-x-3 shrink-0">
            <div className="text-right">
              <span className="text-[11px] text-slate-500 block">Tahmini Üretim</span>
              <span className="text-sm font-bold text-emerald-400">{prodMeterPerHour} m/saat</span>
            </div>
            {onOpenSafetySettings && (
              <button
                onClick={onOpenSafetySettings}
                className="p-1.5 sm:px-2.5 sm:py-1.5 bg-amber-950/60 hover:bg-amber-900/60 text-amber-300 border border-amber-800 rounded-lg text-xs font-medium transition flex items-center space-x-1"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Güvenlik</span>
              </button>
            )}
          </div>
        </div>

        {/* Form Inputs Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-1 text-xs">
          <div>
            <label className="text-slate-400 block mb-1">İncelik (Gauge)</label>
            <select
              value={machine.gauge}
              onChange={(e) => handleMachineChange('gauge', e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none"
            >
              <option value="E18">E18 (Halı / Kaba)</option>
              <option value="E22">E22 (Standart)</option>
              <option value="E24">E24 (İnce)</option>
              <option value="E28">E28 (Tül)</option>
            </select>
          </div>

          <div>
            <label className="text-slate-400 block mb-1">Genişlik (mm)</label>
            <input
              type="number"
              value={machine.workingWidthMm}
              onChange={(e) => handleMachineChange('workingWidthMm', parseFloat(e.target.value) || 0)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-slate-400 block mb-1">Kurs / cm</label>
            <input
              type="number"
              step="0.5"
              value={machine.coursesPerCm}
              onChange={(e) => handleMachineChange('coursesPerCm', parseFloat(e.target.value) || 1)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-slate-400 block mb-1">Sütun / cm</label>
            <input
              type="number"
              step="0.5"
              value={machine.walesPerCm}
              onChange={(e) => handleMachineChange('walesPerCm', parseFloat(e.target.value) || 1)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-slate-400 block mb-1">Hız (RPM)</label>
            <input
              type="number"
              value={machine.rpm}
              onChange={(e) => handleMachineChange('rpm', parseInt(e.target.value) || 100)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-slate-400 block mb-1">Verim (%)</label>
            <input
              type="number"
              value={machine.efficiency}
              onChange={(e) => handleMachineChange('efficiency', parseInt(e.target.value) || 50)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* 2. Guide Bars GB1 - GB6 */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 sm:p-4 space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <span className="font-semibold text-xs text-slate-200">Taraklar & İplik Ayarları (GB1 - GB6)</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {(Object.keys(guideBars) as GuideBarId[]).map((id) => {
            const gb = guideBars[id];
            return (
              <div
                key={id}
                className={`rounded-xl border p-3 transition ${
                  gb.active
                    ? 'bg-slate-950 border-slate-800'
                    : 'bg-slate-950/40 border-slate-900 opacity-50'
                }`}
              >
                <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                  <div className="flex items-center space-x-2">
                    <input
                      type="color"
                      value={gb.color}
                      onChange={(e) => handleGbChange(id, 'color', e.target.value)}
                      className="w-6 h-6 rounded border border-slate-700 bg-transparent cursor-pointer p-0"
                    />
                    <div>
                      <span className="font-bold text-xs text-white">{gb.id}</span>
                      <span className="text-[11px] text-slate-400 ml-1.5">{gb.name.split('(')[1]?.replace(')', '') || ''}</span>
                    </div>
                  </div>

                  <label className="flex items-center space-x-1.5 text-xs text-slate-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={gb.active}
                      onChange={(e) => handleGbChange(id, 'active', e.target.checked)}
                      className="w-3.5 h-3.5 rounded bg-slate-900 border-slate-700 text-blue-600 focus:ring-0"
                    />
                    <span className="text-[11px]">{gb.active ? 'Aktif' : 'Pasif'}</span>
                  </label>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-2 text-[11px]">
                  <div>
                    <span className="text-slate-500 block mb-0.5">Tür</span>
                    <select
                      disabled={!gb.active}
                      value={gb.yarnType}
                      onChange={(e) => handleGbChange(id, 'yarnType', e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded px-1.5 py-1 text-slate-200 text-xs focus:outline-none disabled:opacity-40"
                    >
                      <option value="Polyester">Polyester</option>
                      <option value="Naylon">Naylon</option>
                      <option value="Elastan">Elastan</option>
                      <option value="Pamuk">Pamuk</option>
                    </select>
                  </div>

                  <div>
                    <span className="text-slate-500 block mb-0.5">dtex</span>
                    <input
                      type="number"
                      disabled={!gb.active}
                      value={gb.dtex}
                      onChange={(e) => handleGbChange(id, 'dtex', parseInt(e.target.value) || 0)}
                      className="w-full bg-slate-900 border border-slate-800 rounded px-1.5 py-1 text-slate-200 text-xs focus:outline-none disabled:opacity-40"
                    />
                  </div>

                  <div>
                    <span className="text-slate-500 block mb-0.5">cN</span>
                    <input
                      type="number"
                      disabled={!gb.active}
                      value={gb.tension}
                      onChange={(e) => handleGbChange(id, 'tension', parseInt(e.target.value) || 0)}
                      className="w-full bg-slate-900 border border-slate-800 rounded px-1.5 py-1 text-slate-200 text-xs focus:outline-none disabled:opacity-40"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
