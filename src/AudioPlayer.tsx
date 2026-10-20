import { useEffect, useRef, useState } from 'react';
import { Play, Pause, RotateCcw, Volume2 } from 'lucide-react';
import type { Recording } from './data/birds';
export default function AudioPlayer({
  recording,
  concealed = false,
  onPlayed,
}: {
  recording: Recording;
  concealed?: boolean;
  onPlayed?: () => void;
}) {
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false),
    [time, setTime] = useState(0),
    [duration, setDuration] = useState(0),
    [error, setError] = useState(false);
  useEffect(() => {
    const pause = () => ref.current?.pause();
    const hidden = () => {
      if (document.hidden) pause();
    };
    document.addEventListener('visibilitychange', hidden);
    window.addEventListener('vogel-pause-audio', pause);
    return () => {
      pause();
      document.removeEventListener('visibilitychange', hidden);
      window.removeEventListener('vogel-pause-audio', pause);
    };
  }, []);
  const toggle = async () => {
    if (!ref.current) return;
    if (playing) ref.current.pause();
    else {
      window.dispatchEvent(new Event('vogel-pause-audio'));
      try {
        await ref.current.play();
        setError(false);
        onPlayed?.();
      } catch {
        setError(true);
      }
    }
  };
  const format = (s: number) =>
    `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  return (
    <div className="audio-player">
      <audio
        ref={ref}
        src={recording.path}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onError={() => setError(true)}
        onLoadedMetadata={() => setDuration(ref.current?.duration || 0)}
        onTimeUpdate={() => setTime(ref.current?.currentTime || 0)}
      />
      <div className="player-heading">
        <Volume2 size={16} />
        <span>{concealed ? 'Lausche genau hin' : recording.kind}</span>
        <span className="offline-dot">Offline verfügbar</span>
      </div>
      <div className="player-controls">
        <button
          className="play-button"
          onClick={toggle}
          aria-label={playing ? 'Pausieren' : 'Aufnahme abspielen'}
        >
          {playing ? <Pause fill="currentColor" /> : <Play fill="currentColor" />}
        </button>
        <div className="waveform" aria-hidden="true">
          {Array.from({ length: 45 }, (_, i) => (
            <i
              key={i}
              style={{
                height: `${18 + Math.abs(Math.sin(i * 1.8) * Math.cos(i * 0.35)) * 75}%`,
                opacity: duration && i / 45 < time / duration ? 1 : 0.35,
              }}
            />
          ))}
        </div>
        <button
          className="icon-button"
          aria-label="Von vorne abspielen"
          onClick={() => {
            if (ref.current) ref.current.currentTime = 0;
          }}
        >
          <RotateCcw size={19} />
        </button>
      </div>
      <div className="audio-timeline">
        <span>{format(time)}</span>
        <input
          aria-label="Wiedergabeposition"
          type="range"
          min="0"
          max={duration || 1}
          step="0.1"
          value={time}
          onChange={(e) => {
            if (ref.current) ref.current.currentTime = Number(e.target.value);
          }}
        />
        <span>{format(duration)}</span>
      </div>
      {error && (
        <p role="alert" className="error">
          Die Aufnahme konnte nicht geladen werden. Bitte eine andere Aufnahme wählen.
        </p>
      )}
      {!concealed && (
        <details className="audio-credit">
          <summary>Quelle & Lizenz</summary>
          <p>
            {recording.author} ·{' '}
            <a href={recording.sourceUrl} target="_blank" rel="noreferrer">
              Wikimedia Commons
            </a>{' '}
            ·{' '}
            <a href={recording.licenseUrl} target="_blank" rel="noreferrer">
              {recording.license}
            </a>
          </p>
          <p>{recording.changes}</p>
        </details>
      )}
    </div>
  );
}
