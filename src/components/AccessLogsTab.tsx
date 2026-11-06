import React, { useState, useEffect } from 'react';
import {
  AccessLogItem,
  ActiveUser,
  subscribeToAccessLogs,
  subscribeToActiveUsers,
  deleteAccessLog,
  getSessionId,
  getCachedAccessLogs,
} from '../services/loggingService';
import {
  ShieldAlert,
  Lock,
  Unlock,
  Search,
  Monitor,
  Smartphone,
  MapPin,
  Share2,
  ExternalLink,
  Eye,
  Trash2,
  Check,
  Clock,
  Radio,
  LogOut,
  LogIn,
  Globe,
} from 'lucide-react';

interface AccessLogsTabProps {
  onSelectPatternById?: (patternId: string) => void;
}

const PASSWORD = '741852';

export const AccessLogsTab: React.FC<AccessLogsTabProps> = ({ onSelectPatternById }) => {
  const [isUnlocked, setIsUnlocked] = useState<boolean>(() => {
    if (typeof localStorage !== 'undefined' && localStorage.getItem('warpknitt_logs_unlocked') === 'true') {
      return true;
    }
    if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('warpknitt_logs_unlocked') === 'true') {
      return true;
    }
    return false;
  });

  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState(false);

  // Initialize with local cache so logs are never blank on page reload
  const [logs, setLogs] = useState<AccessLogItem[]>(() => getCachedAccessLogs());
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('Tümü');
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const currentSessionId = typeof sessionStorage !== 'undefined' ? getSessionId() : '';

  useEffect(() => {
    if (!isUnlocked) return;
    const unsubLogs = subscribeToAccessLogs((fetchedLogs) => {
      setLogs(fetchedLogs);
    });
    const unsubActive = subscribeToActiveUsers((users) => {
      setActiveUsers(users);
    });
    return () => {
      unsubLogs();
      unsubActive();
    };
  }, [isUnlocked]);

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput.trim() === PASSWORD) {
      setIsUnlocked(true);
      setAuthError(false);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('warpknitt_logs_unlocked', 'true');
      }
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem('warpknitt_logs_unlocked', 'true');
      }
    } else {
      setAuthError(true);
      setPasswordInput('');
    }
  };

  const handleLockOut = () => {
    setIsUnlocked(false);
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('warpknitt_logs_unlocked');
    }
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem('warpknitt_logs_unlocked');
    }
  };

  const handleDeleteLog = (id: string) => {
    deleteAccessLog(id).then(() => {
      setLogs((prev) => prev.filter((l) => l.id !== id));
      setToastMsg('Log kaydı silindi.');
      setTimeout(() => setToastMsg(null), 2000);
    });
  };

  if (!isUnlocked) {
    return (
      <div className="w-full max-w-md mx-auto px-4 py-12">
        <div className="bg-[#111827] border border-slate-800 rounded-xl p-6 shadow-2xl space-y-4 text-center">
          <div className="w-12 h-12 bg-blue-950/80 border border-blue-800/80 rounded-full flex items-center justify-center mx-auto text-blue-400">
            <Lock className="w-6 h-6" />
          </div>

          <div>
            <h2 className="text-base font-bold text-white tracking-tight">Sistem Giriş-Çıkış & Paylaşım Logları</h2>
            <p className="text-xs text-slate-400 mt-1">
              Veri tabanında kayıtlı canlı loglara erişmek için 6 haneli şifreyi giriniz.
            </p>
          </div>

          <form onSubmit={handleUnlock} className="space-y-3 pt-2">
            <div>
              <input
                type="password"
                inputMode="numeric"
                value={passwordInput}
                onChange={(e) => {
                  setPasswordInput(e.target.value);
                  if (authError) setAuthError(false);
                }}
                placeholder="Şifreyi giriniz (6 Hane)"
                className={`w-full bg-[#0B0F17] border rounded-lg px-3 py-2 text-center text-sm font-mono font-bold text-white focus:outline-none transition-colors ${
                  authError ? 'border-rose-500 focus:border-rose-500' : 'border-slate-700 focus:border-blue-500'
                }`}
                autoFocus
              />
              {authError && (
                <p className="text-xs font-semibold text-rose-400 mt-1 flex items-center justify-center gap-1">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>Hatalı şifre! Lütfen tekrar deneyin.</span>
                </p>
              )}
            </div>

            <button
              type="submit"
              className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Unlock className="w-4 h-4" />
              <span>Giriş Yap</span>
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Filter logs
  const filteredLogs = logs.filter((log) => {
    const matchesType =
      selectedType === 'Tümü' ||
      (selectedType === 'Giriş' && log.type === 'visit') ||
      (selectedType === 'Çıkış' && log.type === 'exit') ||
      (selectedType === 'Paylaşım' && log.type === 'share_created') ||
      (selectedType === 'Açılan Link' && log.type === 'share_opened');

    const searchLower = searchTerm.toLowerCase();
    const matchesSearch =
      !searchTerm ||
      (log.location?.displayLocation || '').toLowerCase().includes(searchLower) ||
      (log.location?.ip || '').toLowerCase().includes(searchLower) ||
      (log.device?.os || '').toLowerCase().includes(searchLower) ||
      (log.device?.browser || '').toLowerCase().includes(searchLower) ||
      (log.patternTitle || '').toLowerCase().includes(searchLower) ||
      (log.duration || '').toLowerCase().includes(searchLower) ||
      (log.shareOrigin?.location || '').toLowerCase().includes(searchLower);

    return matchesType && matchesSearch;
  });

  const visitCount = logs.filter((l) => l.type === 'visit').length;
  const exitCount = logs.filter((l) => l.type === 'exit').length;
  const shareCount = logs.filter((l) => l.type === 'share_created').length;
  const openCount = logs.filter((l) => l.type === 'share_opened').length;

  return (
    <div className="w-full px-2 py-2 space-y-3">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="bg-emerald-950/90 border border-emerald-700 text-emerald-100 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 fixed top-14 right-4 z-50 shadow-xl">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Header & Stats Bar */}
      <section className="bg-[#111827] border border-slate-800 rounded-xl p-3 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-emerald-950/80 border border-emerald-800 rounded-lg text-emerald-400">
              <Unlock className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
                <span>Erişim, Giriş-Çıkış & Paylaşım Logları</span>
                <span className="text-[10px] font-mono px-2 py-0.5 bg-emerald-950 text-emerald-400 border border-emerald-800 rounded-full">
                  Kalıcı Veri Tabanı
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                Canlı kullanıcı sayısı anlık güncellenir. Giriş, çıkış, paylaşılan ve açılan linkler veri tabanında saklanır.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLockOut}
            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer"
            title="Oturumu Kilitle"
          >
            <Lock className="w-3.5 h-3.5 text-rose-400" />
            <span>Kilitle</span>
          </button>
        </div>

        {/* Metric Cards (6 cards) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
          {/* Live Online Users Card */}
          <div className="bg-emerald-950/40 border border-emerald-800/80 p-2.5 rounded-lg flex items-center justify-between">
            <div>
              <span className="text-emerald-400 text-[11px] font-medium flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>Canlı Kişi Sayısı</span>
              </span>
              <strong className="text-base font-bold text-emerald-300 font-mono tabular-nums">{activeUsers.length} Online</strong>
            </div>
            <Radio className="w-4 h-4 text-emerald-400 shrink-0" />
          </div>

          <div className="bg-[#0B0F17] p-2.5 rounded-lg border border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-slate-400 text-[11px] font-medium block">Toplam Kayıt</span>
              <strong className="text-sm font-bold text-white font-mono tabular-nums">{logs.length}</strong>
            </div>
            <Clock className="w-4 h-4 text-blue-400 shrink-0" />
          </div>

          <div className="bg-[#0B0F17] p-2.5 rounded-lg border border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-slate-400 text-[11px] font-medium block">Girişler</span>
              <strong className="text-sm font-bold text-emerald-400 font-mono tabular-nums">{visitCount}</strong>
            </div>
            <LogIn className="w-4 h-4 text-emerald-400 shrink-0" />
          </div>

          <div className="bg-[#0B0F17] p-2.5 rounded-lg border border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-slate-400 text-[11px] font-medium block">Çıkışlar</span>
              <strong className="text-sm font-bold text-rose-400 font-mono tabular-nums">{exitCount}</strong>
            </div>
            <LogOut className="w-4 h-4 text-rose-400 shrink-0" />
          </div>

          <div className="bg-[#0B0F17] p-2.5 rounded-lg border border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-slate-400 text-[11px] font-medium block">Paylaşılan Link</span>
              <strong className="text-sm font-bold text-purple-400 font-mono tabular-nums">{shareCount}</strong>
            </div>
            <Share2 className="w-4 h-4 text-purple-400 shrink-0" />
          </div>

          <div className="bg-[#0B0F17] p-2.5 rounded-lg border border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-slate-400 text-[11px] font-medium block">Açılan Link</span>
              <strong className="text-sm font-bold text-amber-400 font-mono tabular-nums">{openCount}</strong>
            </div>
            <ExternalLink className="w-4 h-4 text-amber-400 shrink-0" />
          </div>
        </div>

        {/* Live Active Users Banner/Grid */}
        {activeUsers.length > 0 && (
          <div className="bg-[#0B0F17] border border-emerald-900/60 rounded-lg p-2.5 space-y-2">
            <div className="flex items-center justify-between text-xs text-emerald-400 font-bold">
              <div className="flex items-center gap-1.5">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
                <span>Anlık Canlı Kullanıcılar (Giriş Yapan Kişiler)</span>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">{activeUsers.length} Kişi Aktif</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-xs">
              {activeUsers.map((u) => {
                const isMe = u.sessionId === currentSessionId;
                const lastSecs = Math.max(0, Math.floor((Date.now() - new Date(u.lastActiveAt).getTime()) / 1000));
                const activeTimeStr = lastSecs < 10 ? 'Şimdi aktif' : `${lastSecs}sn önce`;

                return (
                  <div
                    key={u.sessionId}
                    className={`p-2 rounded border flex items-start justify-between gap-2 ${
                      isMe ? 'bg-emerald-950/30 border-emerald-800' : 'bg-[#111827] border-slate-800'
                    }`}
                  >
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-1 text-[11px] font-bold text-white">
                        {u.device.isMobile ? (
                          <Smartphone className="w-3 h-3 text-purple-400 shrink-0" />
                        ) : (
                          <Monitor className="w-3 h-3 text-blue-400 shrink-0" />
                        )}
                        <span className="truncate">{u.location?.displayLocation || 'Konum Alınıyor'}</span>
                        {isMe && (
                          <span className="text-[9px] bg-emerald-950 text-emerald-400 border border-emerald-800 px-1 rounded shrink-0">
                            Siz
                          </span>
                        )}
                      </div>

                      <div className="text-[10px] text-slate-400 font-mono flex flex-wrap items-center gap-1.5">
                        <span>İP: {u.location?.ip || 'Gizli'}</span>
                        <span>·</span>
                        <span>{u.device.os} / {u.device.browser}</span>
                        {u.device.screen && (
                          <>
                            <span>·</span>
                            <span>{u.device.screen}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <span className="text-[10px] text-emerald-400 font-mono font-semibold shrink-0">
                      {activeTimeStr}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Filter & Search Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {['Tümü', 'Giriş', 'Çıkış', 'Paylaşım', 'Açılan Link'].map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setSelectedType(type)}
                className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors cursor-pointer ${
                  selectedType === type
                    ? 'bg-blue-600 text-white'
                    : 'bg-[#0B0F17] text-slate-300 hover:text-white border border-slate-800'
                }`}
              >
                {type}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Konum, İP, Cihaz veya Süre ara..."
              className="w-full bg-[#0B0F17] border border-slate-700 rounded pl-8 pr-2.5 py-1 text-xs text-white focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
      </section>

      {/* Access Logs List */}
      {filteredLogs.length === 0 ? (
        <div className="bg-[#111827] border border-slate-800 rounded-xl p-8 text-center text-slate-400 text-xs">
          Henüz kayıtlı bir log bulunmuyor.
        </div>
      ) : (
        <div className="space-y-2">
          {filteredLogs.map((log) => {
            const formattedTime = log.timestamp
              ? new Date(log.timestamp).toLocaleString('tr-TR', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })
              : '';

            return (
              <div
                key={log.id}
                className="bg-[#111827] border border-slate-800 hover:border-slate-700 rounded-xl p-3 transition-colors text-xs space-y-2"
              >
                {/* Header row: Log Type Badge + Date + Pattern link */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-1.5 border-b border-slate-800/80">
                  <div className="flex items-center gap-2">
                    {log.type === 'visit' && (
                      <span className="px-2 py-0.5 rounded font-bold text-[11px] bg-emerald-950 text-emerald-400 border border-emerald-800 flex items-center gap-1">
                        <LogIn className="w-3 h-3" />
                        <span>Siteye Giriş Yapıldı</span>
                      </span>
                    )}

                    {log.type === 'exit' && (
                      <span className="px-2 py-0.5 rounded font-bold text-[11px] bg-rose-950 text-rose-400 border border-rose-800 flex items-center gap-1">
                        <LogOut className="w-3 h-3" />
                        <span>Siteden Ayrıldı (Çıkış)</span>
                        {log.duration && (
                          <span className="text-slate-300 font-mono font-normal ml-1">
                            · Oturum: {log.duration}
                          </span>
                        )}
                      </span>
                    )}

                    {log.type === 'share_created' && (
                      <span className="px-2 py-0.5 rounded font-bold text-[11px] bg-purple-950 text-purple-400 border border-purple-800 flex items-center gap-1">
                        <Share2 className="w-3 h-3" />
                        <span>Link Oluşturuldu</span>
                      </span>
                    )}

                    {log.type === 'share_opened' && (
                      <span className="px-2 py-0.5 rounded font-bold text-[11px] bg-amber-950 text-amber-400 border border-amber-800 flex items-center gap-1">
                        <ExternalLink className="w-3 h-3" />
                        <span>Paylaşılan Link Açıldı</span>
                      </span>
                    )}

                    {log.patternTitle && (
                      <button
                        type="button"
                        onClick={() => log.patternId && onSelectPatternById && onSelectPatternById(log.patternId)}
                        className="font-bold text-white hover:text-blue-400 flex items-center gap-1 transition-colors cursor-pointer"
                        title="Deseni Görüntüle"
                      >
                        <span className="text-slate-400">Desen:</span>
                        <span className="text-blue-400 underline">{log.patternTitle}</span>
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 font-mono tabular-nums text-[11px]">{formattedTime}</span>

                    <button
                      type="button"
                      onClick={() => handleDeleteLog(log.id)}
                      className="p-1 text-slate-500 hover:text-rose-400 rounded transition-colors cursor-pointer"
                      title="Logu Sil"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Main Log Info Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {/* Left Column: Client / Opener Device & Location */}
                  <div className="bg-[#0B0F17] p-2.5 rounded-lg border border-slate-800 space-y-1.5">
                    <div className="flex items-center justify-between text-slate-300 font-bold border-b border-slate-800/80 pb-1">
                      <div className="flex items-center gap-1.5">
                        {log.device?.isMobile ? (
                          <Smartphone className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                        ) : (
                          <Monitor className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                        )}
                        <span>{log.type === 'share_opened' ? 'Linki Açan Cihaz & Konum' : 'Cihaz & Konum Bilgileri'}</span>
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {log.device?.isMobile ? 'Mobil' : 'Masaüstü'}
                      </span>
                    </div>

                    <div className="space-y-1 font-mono text-[11px] text-slate-300">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 font-sans">Konum:</span>
                        <span className="text-emerald-400 font-bold flex items-center gap-1">
                          <MapPin className="w-3 h-3 shrink-0 text-emerald-400" />
                          <span>{log.location?.displayLocation || 'Bilinmiyor'}</span>
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 font-sans">İP Adresi:</span>
                        <span className="text-slate-200 font-semibold">{log.location?.ip || 'Gizli'}</span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 font-sans">Cihaz / İŞ:</span>
                        <span className="text-slate-200">{log.device?.os}</span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 font-sans">Tarayıcı:</span>
                        <span className="text-slate-200">{log.device?.browser}</span>
                      </div>

                      {log.device?.screen && (
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400 font-sans">Çözünürlük:</span>
                          <span className="text-slate-300">{log.device.screen}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Column: Share Link Origin Details or Session Info */}
                  {log.type === 'share_opened' && log.shareOrigin ? (
                    <div className="bg-[#0B0F17] p-2.5 rounded-lg border border-amber-900/40 space-y-1.5">
                      <div className="flex items-center justify-between text-amber-300 font-bold border-b border-slate-800/80 pb-1">
                        <span className="flex items-center gap-1.5">
                          <Share2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span>Linkin Paylaşıldığı Orijinal Konum</span>
                        </span>
                      </div>

                      <div className="space-y-1 font-mono text-[11px] text-slate-300">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400 font-sans">Paylaşılan Konum:</span>
                          <span className="text-amber-300 font-bold flex items-center gap-1">
                            <MapPin className="w-3 h-3 shrink-0 text-amber-400" />
                            <span>{log.shareOrigin.location}</span>
                          </span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-slate-400 font-sans">Paylaşan İP:</span>
                          <span className="text-slate-300">{log.shareOrigin.ip || 'Gizli'}</span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-slate-400 font-sans">Paylaşan Cihaz:</span>
                          <span className="text-slate-300">{log.shareOrigin.device}</span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-slate-400 font-sans">Orijinal Tarih:</span>
                          <span className="text-slate-400 text-[10px]">
                            {new Date(log.shareOrigin.timestamp).toLocaleString('tr-TR')}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : log.type === 'exit' ? (
                    <div className="bg-[#0B0F17] p-2.5 rounded-lg border border-rose-900/30 flex flex-col justify-center space-y-1 text-slate-300 font-mono text-[11px]">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 font-sans">İşlem:</span>
                        <span className="text-rose-400 font-bold">Oturum Sonlandı</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 font-sans">Sitede Kalma Süresi:</span>
                        <span className="text-amber-300 font-bold">{log.duration || 'Bilinmiyor'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 font-sans">Oturum ID:</span>
                        <span className="text-slate-400 text-[10px] truncate max-w-[150px]">{log.sessionId || '-'}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-[#0B0F17] p-2.5 rounded-lg border border-slate-800 flex items-center justify-center text-slate-400 font-mono text-[11px]">
                      <span>{log.type === 'share_created' ? 'Paylaşım bağlantısı oluşturuldu.' : 'Siteye doğrudan erişim sağlandı.'}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
