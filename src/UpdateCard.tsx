import { useEffect, useRef, useState } from 'react';
import { Download, RefreshCw, ExternalLink, CheckCircle2 } from 'lucide-react';
import {
  APP_VERSION,
  RELEASES_URL,
  checkForUpdates,
  isAndroidApp,
  nativeUpdater,
  type UpdateInfo,
} from './updates';

type Phase =
  | 'idle'
  | 'checking'
  | 'available'
  | 'current'
  | 'downloading'
  | 'ready'
  | 'installing'
  | 'opened';
export default function UpdateCard() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [error, setError] = useState('');
  const [percent, setPercent] = useState(0);
  const mounted = useRef(true);
  const busy = phase === 'checking' || phase === 'downloading' || phase === 'installing';
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const fail = (value: unknown) => {
    if (mounted.current)
      setError(
        value instanceof Error
          ? value.message
          : 'Die Aktion ist fehlgeschlagen. Bitte erneut versuchen.',
      );
  };
  async function check() {
    setError('');
    setPhase('checking');
    try {
      const result = await checkForUpdates();
      if (mounted.current) {
        setInfo(result);
        setPhase(result.available ? 'available' : 'current');
      }
    } catch (e) {
      fail(e);
      if (mounted.current) setPhase('idle');
    }
  }
  async function install() {
    setError('');
    setPhase('installing');
    try {
      await nativeUpdater.install();
      if (mounted.current) setPhase('opened');
    } catch (e) {
      fail(e);
      if (mounted.current) setPhase('ready');
    }
  }
  async function download() {
    if (!isAndroidApp()) return;
    setError('');
    setPercent(0);
    setPhase('downloading');
    let listener;
    try {
      listener = await nativeUpdater.addListener('downloadProgress', (p) => {
        if (mounted.current)
          setPercent(p.total > 0 ? Math.min(100, Math.floor((p.received / p.total) * 100)) : 0);
      });
      await nativeUpdater.download();
      if (mounted.current) {
        setPercent(100);
        await install();
      }
    } catch (e) {
      fail(e);
      if (mounted.current) setPhase('available');
    } finally {
      await listener?.remove();
    }
  }
  return (
    <section className="panel detail-copy update-card" aria-labelledby="update-heading">
      <h2 id="update-heading">App aktualisieren</h2>
      <p>
        Installiert: <strong>{info?.installedVersion || APP_VERSION}</strong>. Prüfe, ob es eine
        neue Version auf GitHub gibt.
      </p>
      <p>
        Updates werden nur auf deinen Wunsch heruntergeladen. Android fragt vor der Installation
        nach deiner Bestätigung. Dein Lernfortschritt bleibt bei einem Update erhalten.
      </p>
      <div className="update-status" role="status" aria-live="polite">
        {phase === 'checking' && <p>Suche nach der neuesten Version …</p>}
        {phase === 'current' && (
          <p className="update-success">
            <CheckCircle2 size={17} />
            Du bist auf dem neuesten Stand. Neueste Version: {info?.latestVersion}.
          </p>
        )}
        {info?.available && (
          <p>
            <strong>Version {info.latestVersion} ist verfügbar.</strong> Download:{' '}
            {(info.size / 1048576).toLocaleString('de-DE', { maximumFractionDigits: 1 })} MB.
          </p>
        )}
        {phase === 'downloading' && (
          <div>
            <p>Update wird heruntergeladen … {percent} %</p>
            <progress aria-label="Update-Download" max={100} value={percent} />
          </div>
        )}
        {phase === 'installing' && (
          <p>
            Android-Installation wird geöffnet. Erlaube der App bei Bedarf die Installation aus
            dieser Quelle und kehre anschließend zurück.
          </p>
        )}
        {phase === 'opened' && (
          <p>
            Der Android-Installer wurde geöffnet. Bestätige dort „Aktualisieren“. Falls du
            abgebrochen hast, kannst du die Installation erneut öffnen.
          </p>
        )}
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="update-actions">
        <button className="button secondary" disabled={busy} onClick={check}>
          <RefreshCw size={17} />
          Nach Updates suchen
        </button>
        {info?.available &&
          isAndroidApp() &&
          (phase === 'available' || phase === 'downloading') && (
            <button className="button" disabled={busy} onClick={download}>
              <Download size={17} />
              {phase === 'downloading' ? 'Wird geladen …' : 'Update herunterladen & installieren'}
            </button>
          )}
        {(phase === 'ready' || phase === 'opened' || phase === 'installing') && (
          <button className="button" disabled={busy} onClick={install}>
            <Download size={17} />
            Installation öffnen
          </button>
        )}
      </div>
      {!isAndroidApp() && (
        <p className="small muted">
          Die direkte Installation steht in der Android-App zur Verfügung. Im Browser kannst du die
          APK über GitHub herunterladen.
        </p>
      )}
      <a className="text-button" href={RELEASES_URL} target="_blank" rel="noreferrer">
        Releases auf GitHub <ExternalLink size={14} />
      </a>
    </section>
  );
}
