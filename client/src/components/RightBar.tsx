import React, { useRef, useState } from 'react';
import { useActive } from '@/context/ActiveContext';
import { AndroidKeycode } from '@/lib/keyEvent';
import { useDirectKeyboard } from '@/hooks/useDirectKeyboard';
import { useServer } from '@/context/ServerContext';
import { installApk, installUploadedApk, installApkToMany } from '@/lib/serverApi';
import { useI18n } from '@/context/I18nContext';
import {
  ArrowLeft,
  Camera,
  ChevronsLeft,
  Home,
  Link2,
  Package,
  Power,
  Square,
  Menu,
  Volume1,
  Volume2,
  VolumeX,
} from 'lucide-react';

type RightBarProps = {
  hidden?: boolean;
  showExpand?: boolean;
  onExpand?: () => void;
  hideSyncButtons?: boolean;
};

export function RightBar({ hidden, showExpand, onExpand, hideSyncButtons }: RightBarProps) {
  const {
    activeUdid,
    sendKeyTap,
    screenshotActiveCanvas,
    syncAll,
    setSyncAll,
    syncMain,
    setSyncMain,
    registeredUdids,
    stopSync,
  } = useActive();
  const { t } = useI18n();
  const { wsServer } = useServer();
  const [installStatus, setInstallStatus] = useState<string | null>(null);

  const kbBarRef = useRef<HTMLDivElement | null>(null);
  useDirectKeyboard(true, kbBarRef.current);
  const apkInputRef = useRef<HTMLInputElement | null>(null);
  const apkAllInputRef = useRef<HTMLInputElement | null>(null);

  const handleApkAllSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!registeredUdids.length) {
      setInstallStatus(t('Không có thiết bị nào đang kết nối'));
      return;
    }
    try {
      setInstallStatus(t('Đang upload {name}...', { name: file.name }));
      const results = await installApkToMany(wsServer, registeredUdids, file, (msg) =>
        setInstallStatus(msg),
      );
      const ok = results.filter((r) => r.success).length;
      const fail = results.filter((r) => !r.success).length;
      const details = results
        .map((r) => `${r.udid.slice(-6)}: ${r.success ? '✓' : `✗ ${r.error ?? ''}`}`)
        .join('  ');
      setInstallStatus(`${ok}/${results.length} thành công${fail ? ` (${fail} lỗi)` : ''} — ${details}`);
    } catch (err: any) {
      setInstallStatus(err?.message || t('Cài APK thất bại'));
    }
  };

  const triggerApkAllPicker = () => {
    if (!registeredUdids.length) {
      setInstallStatus(t('Không có thiết bị nào đang kết nối'));
      return;
    }
    apkAllInputRef.current?.click();
  };

  const handleApkSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!activeUdid) {
      setInstallStatus(t('Chọn device trước khi cài APK'));
      return;
    }
    try {
      setInstallStatus(t('Đang upload {name}...', { name: file.name }));
      const saved = await installApk(wsServer, activeUdid, file);
      setInstallStatus(
        t('Đã lưu lên server: {name}, đang cài...', { name: saved || file.name }),
      );
      await installUploadedApk(wsServer, activeUdid, saved || file.name);
      setInstallStatus(t('Đã cài: {name}', { name: file.name }));
    } catch (err: any) {
      setInstallStatus(err?.message || t('Cài/Upload APK thất bại'));
    }
  };

  const triggerApkPicker = () => {
    if (!activeUdid) {
      setInstallStatus(t('Chọn device trước khi cài APK'));
      return;
    }
    apkInputRef.current?.click();
  };

  const ensureMainSelected = () => {
    if (syncMain || !registeredUdids.length) return;
    const fallback = activeUdid || registeredUdids[0] || null;
    if (fallback) setSyncMain(fallback);
  };

  const handleSyncToggle = () => {
    if (syncAll) {
      stopSync();
      return;
    }
    setSyncAll(true);
    ensureMainSelected();
  };

  const handleStopSync = () => {
    stopSync();
  };

  return (
    <>
      <div
        id="rightbar"
        ref={kbBarRef}
        className={hidden ? 'rb-hidden' : undefined}
      >
        {showExpand ? (
          <button
            className="rb-btn"
            title={t('Mở rộng bảng cấu hình')}
            onClick={onExpand}
          >
            <span className="rb-icon">
              <ChevronsLeft size={16} strokeWidth={1.8} />
            </span>
          </button>
        ) : null}
        {hideSyncButtons ? null : (
          <>
            <button
              className={`rb-btn ${syncAll ? 'on' : ''}`}
              title={
                syncAll
                  ? t('Sync đang bật: gửi thao tác tới tất cả thiết bị đang mở')
                  : t('Sync đang tắt: chỉ điều khiển thiết bị đang focus')
              }
              onClick={handleSyncToggle}
            >
              <span className="rb-icon">
                <Link2 size={16} strokeWidth={1.8} />
              </span>
            </button>
            {syncAll ? (
              <button className="rb-btn rb-stop" title={t('Dừng sync')} onClick={handleStopSync}>
                <span className="rb-icon">
                  <Square size={14} strokeWidth={1.8} />
                </span>
              </button>
            ) : null}
          </>
        )}

        <button className="rb-btn" title={t('Nguồn')} onClick={() => sendKeyTap(AndroidKeycode.KEYCODE_POWER)}>
          <span className="rb-icon">
            <Power size={16} strokeWidth={1.8} />
          </span>
        </button>
        <button className="rb-btn" title={t('Tăng âm lượng')} onClick={() => sendKeyTap(AndroidKeycode.KEYCODE_VOLUME_UP)}>
          <span className="rb-icon">
            <Volume2 size={16} strokeWidth={1.8} />
          </span>
        </button>
        <button className="rb-btn" title={t('Giảm âm lượng')} onClick={() => sendKeyTap(AndroidKeycode.KEYCODE_VOLUME_DOWN)}>
          <span className="rb-icon">
            <Volume1 size={16} strokeWidth={1.8} />
          </span>
        </button>
        <button className="rb-btn" title={t('Tắt tiếng')} onClick={() => sendKeyTap(AndroidKeycode.KEYCODE_VOLUME_MUTE)}>
          <span className="rb-icon">
            <VolumeX size={16} strokeWidth={1.8} />
          </span>
        </button>

        <div className="rb-sep" />

        <button className="rb-btn" title={t('Quay lại')} onClick={() => sendKeyTap(AndroidKeycode.KEYCODE_BACK)}>
          <span className="rb-icon">
            <ArrowLeft size={16} strokeWidth={1.8} />
          </span>
        </button>
        <button className="rb-btn" title={t('Về Home')} onClick={() => sendKeyTap(AndroidKeycode.KEYCODE_HOME)}>
          <span className="rb-icon">
            <Home size={16} strokeWidth={1.8} />
          </span>
        </button>
        <button className="rb-btn" title={t('Đa nhiệm')} onClick={() => sendKeyTap(AndroidKeycode.KEYCODE_APP_SWITCH)}>
          <span className="rb-icon">
            <Menu size={16} strokeWidth={1.8} />
          </span>
        </button>

        <div className="rb-sep" />

        <button className="rb-btn" title={t('Chụp màn hình (tile active)')} onClick={() => screenshotActiveCanvas()}>
          <span className="rb-icon">
            <Camera size={16} strokeWidth={1.8} />
          </span>
        </button>
        <button className="rb-btn" title={t('Cài APK (device active)')} onClick={triggerApkPicker}>
          <span className="rb-icon">
            <Package size={16} strokeWidth={1.8} />
          </span>
        </button>
        <button
          className="rb-btn"
          title={t('Cài APK tất cả thiết bị ({count})', { count: registeredUdids.length })}
          onClick={triggerApkAllPicker}
          disabled={!registeredUdids.length}
        >
          <span className="rb-icon" style={{ position: 'relative' }}>
            <Package size={16} strokeWidth={1.8} />
            <span style={{ position: 'absolute', top: -4, right: -5, fontSize: 9, fontWeight: 700, background: '#4a90e2', color: '#fff', borderRadius: 4, padding: '0 2px', lineHeight: '12px' }}>
              {registeredUdids.length}
            </span>
          </span>
        </button>
        <input
          ref={apkInputRef}
          type="file"
          accept=".apk,.xapk,.zip,application/vnd.android.package-archive,application/zip"
          style={{ display: 'none' }}
          onChange={handleApkSelect}
        />
        <input
          ref={apkAllInputRef}
          type="file"
          accept=".apk,.xapk,.zip,application/vnd.android.package-archive,application/zip"
          style={{ display: 'none' }}
          onChange={handleApkAllSelect}
        />
        {installStatus ? <div style={{ fontSize: 11, color: '#9bc1ff', marginTop: 6, wordBreak: 'break-all' }}>{installStatus}</div> : null}

        <div className="rb-spacer" />

        {/* Locale switch moved to header */}
      </div>

      {/* Sync modal removed; sync handled via right config panel */}
    </>
  );
}
