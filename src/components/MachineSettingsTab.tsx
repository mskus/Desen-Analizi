import React from 'react';
import { MachineProfile, GuideBarConfig, GuideBarId } from '../types';
import { Sliders, Zap, Gauge, Layers, Activity, Palette, ShieldCheck } from 'lucide-react';

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

  // Production calculation estimate
  // Production (m/h) = (RPM * 60 * CourseLength) / CoursesPerMeter / 1000 ... simplified formula
  const coursePerMeter = machine.coursesPerCm * 100;
  const prodMeterPerHour = ((machine.rpm * 60 * (machine.efficiency / 100)) / coursePerMeter).toFixed(1);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Top Banner / Machine Info */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
          <div className="flex items-center space-x-4">
            <div className="bg-blue-600/20 text-blue-400 p-3.5 rounded-2xl border border-blue-500/30">
              <Zap className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-xl font-bold text-white tracking-tight">{machine.brandModel}</h2>
                <span className="px-2.5 py-0.5 text-xs font-bold bg-emerald-500/20 text-emerald-300 rounded-full border border-emerald-500/30">
                  {machine.gauge} Aktif
                </span>
              </div>
              <p className="text-sm text-slate-400 mt-0.5">
                Double Needle Bar Warp Knitting Machine (Çift Plaka Çözgülü Örme Makinesi)
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-4 bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
            <div>
              <span className="text-xs text-slate-400 block">Tahmini Üretim</span>
              <span className="text-lg font-bold text-emerald-400">{prodMeterPerHour} m / saat</span>
            </div>
            <div className="border-l border-slate-800 pl-4">
              <span className="text-xs text-slate-400 block">Güç / Voltaj</span>
              <span className="text-lg font-bold text-blue-400">{machine.powerKw} kW / {machine.voltageV}V</span>
            </div>
            {onOpenSafetySettings && (
              <button
                onClick={onOpenSafetySettings}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/30 rounded-xl text-xs font-bold transition ml-2 self-center"
              >
                <ShieldCheck className="w-4 h-4 text-amber-400" />
                <span>Güvenli Tarak Menüsü</span>
              </button>
            )}
          </div>
        </div>

        {/* Machine Technical Parameters Form */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pt-6">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Makine İnceliği (Gauge)
            </label>
            <select
              value={machine.gauge}
              onChange={(e) => handleMachineChange('gauge', e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="E18">E18 (Kaba / Halı & Teknik)</option>
              <option value="E22">E22 (Standart / Standart File)</option>
              <option value="E24">E24 (İnce / Spor Giyim)</option>
              <option value="E28">E28 (Çok İnce / İç Giyim & Tül)</option>
              <option value="E32">E32 (Ultra İnce / Medikal)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Çalışma Genişliği (mm / inch)
            </label>
            <div className="flex space-x-2">
              <input
                type="number"
                value={machine.workingWidthMm}
                onChange={(e) => handleMachineChange('workingWidthMm', parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="flex items-center text-xs text-slate-400 font-medium">mm ({machine.workingWidthInch}&quot;)</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Kurs Sıklığı (Courses / cm)
            </label>
            <input
              type="number"
              step="0.5"
              value={machine.coursesPerCm}
              onChange={(e) => handleMachineChange('coursesPerCm', parseFloat(e.target.value) || 1)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Sütun Sıklığı (Wales / cm)
            </label>
            <input
              type="number"
              step="0.5"
              value={machine.walesPerCm}
              onChange={(e) => handleMachineChange('walesPerCm', parseFloat(e.target.value) || 1)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Çalışma Hızı (RPM)
            </label>
            <input
              type="number"
              value={machine.rpm}
              onChange={(e) => handleMachineChange('rpm', parseInt(e.target.value) || 100)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Verimlilik (%)
            </label>
            <input
              type="number"
              value={machine.efficiency}
              onChange={(e) => handleMachineChange('efficiency', parseInt(e.target.value) || 50)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Güç Tüketimi (kW)
            </label>
            <input
              type="number"
              value={machine.powerKw}
              onChange={(e) => handleMachineChange('powerKw', parseFloat(e.target.value) || 10)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Gerilim (V)
            </label>
            <input
              type="number"
              value={machine.voltageV}
              onChange={(e) => handleMachineChange('voltageV', parseInt(e.target.value) || 380)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Guide Bars (GB1 - GB6) Management */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="bg-indigo-600/20 text-indigo-400 p-2.5 rounded-xl border border-indigo-500/30">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Tarak Aktiflik & İplik Parametreleri (GB1 - GB6)</h3>
              <p className="text-xs text-slate-400">Her bir tarak için iplik türü, dtex, tansiyon ve renk ataması yapın.</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {(Object.keys(guideBars) as GuideBarId[]).map((id) => {
            const gb = guideBars[id];
            return (
              <div
                key={id}
                className={`rounded-2xl border p-5 transition-all space-y-4 ${
                  gb.active
                    ? 'bg-slate-950/80 border-slate-700 shadow-lg shadow-black/40'
                    : 'bg-slate-950/30 border-slate-900 opacity-60'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <input
                      type="color"
                      value={gb.color}
                      onChange={(e) => handleGbChange(id, 'color', e.target.value)}
                      className="w-8 h-8 rounded-lg border border-slate-700 bg-transparent cursor-pointer"
                    />
                    <div>
                      <h4 className="font-bold text-sm text-slate-100">{gb.id}</h4>
                      <span className="text-xs text-slate-400">{gb.name.split(' ')[1] || ''}</span>
                    </div>
                  </div>

                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={gb.active}
                      onChange={(e) => handleGbChange(id, 'active', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                <div className="grid grid-cols-3 gap-2.5 pt-2 border-t border-slate-800/80">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">İplik Türü</label>
                    <select
                      disabled={!gb.active}
                      value={gb.yarnType}
                      onChange={(e) => handleGbChange(id, 'yarnType', e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                    >
                      <option value="Polyester">Polyester</option>
                      <option value="Elastan">Elastan</option>
                      <option value="Naylon">Naylon</option>
                      <option value="Pamuk">Pamuk</option>
                      <option value="Viskon">Viskon</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">İnce (dtex)</label>
                    <input
                      type="number"
                      disabled={!gb.active}
                      value={gb.dtex}
                      onChange={(e) => handleGbChange(id, 'dtex', parseInt(e.target.value) || 0)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">Tansiyon (cN)</label>
                    <input
                      type="number"
                      disabled={!gb.active}
                      value={gb.tension}
                      onChange={(e) => handleGbChange(id, 'tension', parseInt(e.target.value) || 0)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
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
