import { useEffect, useRef, useState } from 'react';
import { App as NativeApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import {
  ArrowLeft,
  ArrowRight,
  Bird as BirdIcon,
  BookOpen,
  Check,
  ChevronRight,
  Feather,
  Headphones,
  Home,
  Leaf,
  Moon,
  Search,
  Settings,
  ShieldCheck,
  Sun,
  Target,
  TrendingUp,
  X,
  RotateCcw,
  ExternalLink,
  CheckCircle2,
} from 'lucide-react';
import { birds, type Bird, type Credit } from './data/birds';
import AudioPlayer from './AudioPlayer';
import {
  emptyProgress,
  makeQueue,
  readProgress,
  shuffle,
  updateAnswer,
  type Progress,
} from './learning';

type Tab = 'home' | 'birds' | 'learn' | 'progress' | 'settings' | 'sources';
type Question = { bird: Bird; recording: number; options: string[] };
type Session = {
  mode: 'quiz' | 'learn';
  questions: Question[];
  index: number;
  selected: string | null;
  revealed: boolean;
  score: number;
  played: boolean;
  finished: boolean;
};
function getSetting(key: string, fallback: string) {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}
const stopAudio = () => window.dispatchEvent(new Event('vogel-pause-audio'));

function CreditLine({ credit }: { credit: Credit }) {
  return (
    <div className="credit-line">
      <p>{credit.author}</p>
      <a href={credit.sourceUrl} target="_blank" rel="noreferrer">
        Original & Metadaten <ExternalLink size={12} />
      </a>
      <a href={credit.licenseUrl} target="_blank" rel="noreferrer">
        {credit.license}
      </a>
      <small>{credit.changes}</small>
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState<Tab>('home'),
    [detail, setDetail] = useState<Bird | null>(null),
    [query, setQuery] = useState('');
  const [progress, setProgress] = useState<Progress>(readProgress),
    [storageError, setStorageError] = useState(false);
  const [theme, setTheme] = useState(() => getSetting('vogelstimmen.theme', 'light'));
  const [length, setLength] = useState(() =>
    Number(getSetting('vogelstimmen.length', '10')) === 5 ? 5 : 10,
  );
  const [selectedBirds, setSelectedBirds] = useState<string[]>(birds.map((b) => b.id));
  const [session, setSession] = useState<Session | null>(null),
    [clip, setClip] = useState(0),
    [confirmReset, setConfirmReset] = useState(false),
    [confirmExit, setConfirmExit] = useState(false);
  const [notice, setNotice] = useState('');
  const currentState = useRef({ session, detail, tab });
  currentState.current = { session, detail, tab };
  useEffect(() => {
    try {
      localStorage.setItem('vogelstimmen.progress.v1', JSON.stringify(progress));
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  }, [progress]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('vogelstimmen.theme', theme);
    } catch {}
  }, [theme]);
  useEffect(() => {
    try {
      localStorage.setItem('vogelstimmen.length', String(length));
    } catch {}
  }, [length]);
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const back = NativeApp.addListener('backButton', () => {
      const s = currentState.current;
      stopAudio();
      if (s.session && !s.session.finished) {
        setConfirmExit(true);
        return;
      }
      if (s.session) {
        setSession(null);
        return;
      }
      if (s.detail) {
        setDetail(null);
        return;
      }
      if (s.tab !== 'home') {
        setTab('home');
        return;
      }
      NativeApp.minimizeApp();
    });
    const state = NativeApp.addListener('appStateChange', ({ isActive }) => {
      if (!isActive) stopAudio();
    });
    return () => {
      void back.then((h) => h.remove());
      void state.then((h) => h.remove());
    };
  }, []);
  useEffect(() => {
    window.scrollTo(0, 0);
    document.querySelector('.session-overlay')?.scrollTo(0, 0);
  }, [tab, detail, session?.index, session?.finished]);
  const navigate = (next: Tab) => {
    stopAudio();
    setDetail(null);
    setTab(next);
    setQuery('');
  };
  const openBird = (bird: Bird) => {
    stopAudio();
    setClip(0);
    setDetail(bird);
  };
  const practiced = birds.filter((b) => progress.birds[b.id]?.seen > 0).length;
  const due = birds.filter(
    (b) => !progress.birds[b.id] || progress.birds[b.id].due <= Date.now(),
  ).length;
  const accuracy = progress.quizAnswers
    ? Math.round((progress.quizCorrect / progress.quizAnswers) * 100)
    : 0;
  const mastered = birds.filter((b) => (progress.birds[b.id]?.box || 0) >= 3).length;
  function start(mode: 'quiz' | 'learn') {
    const available = birds.filter((b) => selectedBirds.includes(b.id) && b.recordings.length);
    if (available.length < (mode === 'quiz' ? 4 : 1)) {
      setNotice(
        mode === 'quiz'
          ? 'Bitte mindestens vier Arten auswählen.'
          : 'Bitte mindestens eine Art auswählen.',
      );
      return;
    }
    stopAudio();
    setNotice('');
    const questions = makeQueue(
      available.map((b) => b.id),
      progress,
      length,
    ).map((id) => {
      const bird = available.find((b) => b.id === id)!;
      const candidates = bird.recordings
        .map((r, i) => ({ r, i }))
        .filter(({ r }) => r.path !== progress.birds[id]?.lastRecording);
      const recording = shuffle(
        candidates.length ? candidates : bird.recordings.map((r, i) => ({ r, i })),
      )[0].i;
      return {
        bird,
        recording,
        options: shuffle([
          id,
          ...shuffle(available.filter((b) => b.id !== id).map((b) => b.id)).slice(0, 3),
        ]),
      };
    });
    setSession({
      mode,
      questions,
      index: 0,
      selected: null,
      revealed: false,
      score: 0,
      played: false,
      finished: false,
    });
  }
  function answer(id: string, correct: boolean) {
    if (!session || session.selected !== null) return;
    const q = session.questions[session.index];
    setProgress((p) =>
      updateAnswer(
        p,
        q.bird.id,
        correct,
        session.mode === 'quiz' ? id : undefined,
        q.bird.recordings[q.recording].path,
        Date.now(),
        session.mode === 'quiz',
      ),
    );
    setSession({
      ...session,
      selected: id,
      revealed: true,
      score: session.score + Number(correct),
    });
  }
  function next() {
    if (!session) return;
    stopAudio();
    if (session.index === session.questions.length - 1) {
      setProgress((p) => ({ ...p, rounds: p.rounds + 1 }));
      setSession({ ...session, finished: true });
    } else
      setSession({
        ...session,
        index: session.index + 1,
        selected: null,
        revealed: false,
        played: false,
      });
  }
  const nav = [
    { id: 'home', label: 'Start', icon: Home },
    { id: 'birds', label: 'Vögel', icon: BookOpen },
    { id: 'learn', label: 'Lernen', icon: Headphones },
    { id: 'progress', label: 'Fortschritt', icon: TrendingUp },
  ] as const;

  return (
    <div className="app-shell">
      <aside className="desktop-sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            navigate('home');
          }}
        >
          <span className="brand-mark">
            <Feather size={23} />
          </span>
          <span>
            Vogelstimmen<span className="brand-sub">DEIN OHR FÜR DIE NATUR</span>
          </span>
        </a>
        <span className="nav-caption">DEIN LERNRAUM</span>
        <nav>
          {nav.map(({ id, label, icon: Icon }) => (
            <button key={id} className={tab === id ? 'active' : ''} onClick={() => navigate(id)}>
              <Icon size={19} />
              {label}
              {id === 'birds' && <span className="count">10</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="offline-card">
            <Leaf size={20} />
            <strong>Ein Stück Natur. Für dich.</strong>
            <p>
              10 Arten. Echte Stimmen.
              <br />
              Immer dabei, auch offline.
            </p>
          </div>
          <button onClick={() => navigate('sources')}>
            <BookOpen size={17} />
            Quellen & Lizenzen
          </button>
          <button onClick={() => navigate('settings')}>
            <Settings size={17} />
            Einstellungen
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="mobile-brand">
            <Feather size={20} />
            <strong>Vogelstimmen</strong>
          </div>
          <div className="desktop-breadcrumb">
            Dein Lernraum <ChevronRight size={14} />
            <strong>
              {detail
                ? detail.name
                : {
                    home: 'Übersicht',
                    birds: 'Vogellexikon',
                    learn: 'Training',
                    progress: 'Fortschritt',
                    settings: 'Einstellungen',
                    sources: 'Quellen & Lizenzen',
                  }[tab]}
            </strong>
          </div>
          <div className="topbar-actions">
            <span className="offline-badge">
              <span />
              Offline bereit
            </span>
            <button
              className="icon-button"
              aria-label={theme === 'dark' ? 'Hellen Modus aktivieren' : 'Dunklen Modus aktivieren'}
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            >
              {theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}
            </button>
            <button
              className="icon-button"
              aria-label="Einstellungen"
              onClick={() => navigate('settings')}
            >
              <Settings size={19} />
            </button>
          </div>
        </header>
        <main>
          {storageError && (
            <p className="error" role="alert">
              Dein Fortschritt konnte nicht gespeichert werden. Er bleibt nur für diese Sitzung
              erhalten.
            </p>
          )}
          {detail ? (
            <>
              <button
                className="back-link"
                onClick={() => {
                  stopAudio();
                  setDetail(null);
                }}
              >
                <ArrowLeft size={17} />
                Zurück
              </button>
              <div className="detail-layout">
                <div>
                  <div className="detail-photo">
                    {detail.image ? (
                      <img src={detail.image.path} alt={detail.name} />
                    ) : (
                      <BirdIcon size={100} />
                    )}
                    <span className="photo-label">{detail.level}</span>
                  </div>
                  <div className="photo-attribution">
                    {detail.image && (
                      <>
                        Foto: {detail.image.author} ·{' '}
                        <a href={detail.image.sourceUrl} target="_blank" rel="noreferrer">
                          {detail.image.license}
                        </a>
                      </>
                    )}
                  </div>
                  <div className="panel detail-copy">
                    <span className="eyebrow">GENAU HINSEHEN</span>
                    <h2>So erkennst du sie</h2>
                    <p>{detail.appearance}</p>
                    <h3>Lebensraum</h3>
                    <p>{detail.habitat}</p>
                    <h3>Typische Gesangszeit</h3>
                    <p>{detail.season}</p>
                  </div>
                </div>
                <div>
                  <span className="eyebrow">HEIMISCHE VOGELSTIMMEN</span>
                  <h1>{detail.name}</h1>
                  <p className="scientific">{detail.scientific}</p>
                  <div className="panel detail-copy">
                    <h2>Eine Stimme, die du kennenlernst.</h2>
                    <p>{detail.voice}</p>
                    <div className="mnemonic">
                      <Feather size={19} />
                      <div>
                        <strong>Deine Hörhilfe</strong>
                        <p>{detail.mnemonic}</p>
                      </div>
                    </div>
                    <h3>Hörbeispiele</h3>
                    <div className="clip-tabs">
                      {detail.recordings.map((r, i) => (
                        <button
                          key={r.path}
                          className={clip === i ? 'selected' : ''}
                          onClick={() => {
                            stopAudio();
                            setClip(i);
                          }}
                        >
                          Aufnahme {i + 1}
                          <small>{r.kind}</small>
                        </button>
                      ))}
                    </div>
                    {detail.recordings[clip] && (
                      <AudioPlayer
                        key={detail.recordings[clip].path}
                        recording={detail.recordings[clip]}
                      />
                    )}
                    <h3>Genau unterscheiden</h3>
                    <p>{detail.compare}</p>
                  </div>
                  <p className="muted small">
                    Hörhilfen beschreiben typische Muster. Vogelstimmen haben viele Varianten.
                  </p>
                </div>
              </div>
            </>
          ) : tab === 'home' ? (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">
                    <Leaf size={14} /> HÖREN. ERKENNEN. DRAUSSEN WIEDERFINDEN.
                  </span>
                  <h1>Die Natur hat viel zu erzählen.</h1>
                  <p>Lerne die Stimmen vor deiner Haustür kennen.</p>
                </div>
                <span className="date-chip">Dein privater Vogeltrainer</span>
              </div>
              <section className="hero">
                <div className="hero-copy">
                  <span className="hero-tag">
                    <Headphones size={14} /> ZEIT FÜR EINE KLEINE AUSZEIT
                  </span>
                  <h2>
                    Ein Vogel singt.
                    <br />
                    Weißt du, welcher?
                  </h2>
                  <p>
                    Von der ersten Amsel bis zum feinen Zilpzalp.
                    <br /> Schärfe dein Gehör, eine Stimme nach der anderen.
                  </p>
                  <button className="button hero-button" onClick={() => start('quiz')}>
                    Hörquiz starten <ArrowRight size={18} />
                  </button>
                  <span className="hero-note">10 Fragen · in deinem Tempo · ohne Zeitdruck</span>
                </div>
                <div className="hero-image">
                  {birds[3].image && <img src={birds[3].image.path} alt="Rotkehlchen" />}
                  <div className="hero-image-overlay" />
                  <span className="image-caption">
                    Ein kleiner Sänger. Eine große Entdeckung.
                    <small>
                      {birds[3].image?.author} · {birds[3].image?.license}
                    </small>
                  </span>
                </div>
              </section>
              <div className="metric-grid">
                <Metric
                  label="Arten entdeckt"
                  value={`${practiced} / 10`}
                  note="Deine heimischen Sänger"
                  icon={<BirdIcon size={19} />}
                />
                <Metric
                  label="Trefferquote"
                  value={progress.quizAnswers ? `${accuracy} %` : '–'}
                  note={
                    progress.quizAnswers
                      ? `${progress.quizAnswers} Quizantworten`
                      : 'Deine erste Runde wartet'
                  }
                  icon={<Target size={19} />}
                />
                <Metric
                  label="Sicher erkannt"
                  value={`${mastered}`}
                  note="Ab drei sicheren Wiederholungen"
                  icon={<CheckCircle2 size={19} />}
                />
              </div>
              <div className="home-columns">
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Dein nächster Schritt</h2>
                      <p>Ein bisschen Übung macht den Unterschied.</p>
                    </div>
                    <span className="soft-badge">{due} zum Lernen</span>
                  </div>
                  <div className="next-step">
                    <div className="large-icon">
                      <Headphones size={28} />
                    </div>
                    <div>
                      <h3>Erst lauschen, dann entdecken.</h3>
                      <p>
                        Lerne mit Hörkarten und wiederhole die Arten, bei denen du noch unsicher
                        bist.
                      </p>
                      <button
                        className="text-button"
                        onClick={() => {
                          navigate('learn');
                        }}
                      >
                        Zum Lernbereich <ArrowRight size={16} />
                      </button>
                    </div>
                  </div>
                  <div className="panel-footer">
                    <ShieldCheck size={15} /> Dein Fortschritt bleibt auf deinem Gerät.
                  </div>
                </section>
                <section className="panel bird-tip">
                  <span className="eyebrow">KLEINER HÖRTIPP</span>
                  <span className="quote-mark">“</span>
                  <h3>Hör auf den Rhythmus.</h3>
                  <p>
                    Die Singdrossel wiederholt ihre Motive. Die Amsel lässt zwischen ihren
                    Flötenstrophen mehr Raum.
                  </p>
                  <button className="text-button" onClick={() => openBird(birds[1])}>
                    Singdrossel kennenlernen <ArrowRight size={16} />
                  </button>
                </section>
              </div>
              <div className="section-heading">
                <div>
                  <span className="eyebrow">ZEHN STIMMEN, EIN ANFANG</span>
                  <h2>Deine Nachbarn im Grünen</h2>
                </div>
                <button className="text-button" onClick={() => navigate('birds')}>
                  Alle Vögel <ArrowRight size={16} />
                </button>
              </div>
              <div className="bird-grid home-birds">
                {birds.slice(0, 4).map((b) => (
                  <BirdCard key={b.id} bird={b} onClick={() => openBird(b)} progress={progress} />
                ))}
              </div>
            </>
          ) : tab === 'birds' ? (
            <>
              <PageHeading
                eyebrow="DEIN KLEINES VOGELLEXIKON"
                title="Zehn Arten. Zehn eigene Stimmen."
                subtitle="Lerne die Sänger kennen, die dir draußen begegnen."
              />
              <label className="search">
                <Search size={18} />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Vogel suchen …"
                  aria-label="Vogel suchen"
                />
                {query && (
                  <button
                    className="icon-button"
                    onClick={() => setQuery('')}
                    aria-label="Suche löschen"
                  >
                    <X size={16} />
                  </button>
                )}
                <span>
                  {
                    birds.filter((b) =>
                      (b.name + ' ' + b.scientific)
                        .toLocaleLowerCase('de')
                        .includes(query.toLocaleLowerCase('de')),
                    ).length
                  }{' '}
                  Arten
                </span>
              </label>
              <div className="bird-grid">
                {birds
                  .filter((b) =>
                    (b.name + ' ' + b.scientific)
                      .toLocaleLowerCase('de')
                      .includes(query.toLocaleLowerCase('de')),
                  )
                  .map((b) => (
                    <BirdCard key={b.id} bird={b} onClick={() => openBird(b)} progress={progress} />
                  ))}
              </div>
              {!birds.some((b) =>
                (b.name + ' ' + b.scientific)
                  .toLocaleLowerCase('de')
                  .includes(query.toLocaleLowerCase('de')),
              ) && (
                <div className="empty-state">
                  <Search size={28} />
                  <h2>Kein Vogel gefunden</h2>
                  <p>Versuche einen anderen Namen.</p>
                </div>
              )}
            </>
          ) : tab === 'learn' ? (
            <>
              <PageHeading
                eyebrow="DEIN OHR WIRD IMMER BESSER"
                title="Lauschen wird zu Wiedererkennen."
                subtitle="Wähle dein Training. Ohne Zeitdruck, in deinem Tempo."
              />
              <div className="training-modes">
                <section className="panel mode-card">
                  <div className="large-icon">
                    <BookOpen size={29} />
                  </div>
                  <span className="soft-badge">Kennenlernen & wiederholen</span>
                  <h2>Hörkarten</h2>
                  <p>
                    Höre eine Stimme, überlege kurz und decke die Art auf. Du entscheidest, wie
                    sicher du sie erkannt hast.
                  </p>
                  <button className="button" onClick={() => start('learn')}>
                    Mit Hörkarten lernen <ArrowRight size={17} />
                  </button>
                </section>
                <section className="panel mode-card quiz-card">
                  <div className="large-icon">
                    <Headphones size={29} />
                  </div>
                  <span className="soft-badge">Dein Wissen ausprobieren</span>
                  <h2>Das Vogelstimmen-Quiz</h2>
                  <p>
                    Eine Aufnahme, vier Arten. Erkenne den Sänger und erfahre direkt, woran du seine
                    Stimme unterscheiden kannst.
                  </p>
                  <button className="button" onClick={() => start('quiz')}>
                    Hörquiz starten <ArrowRight size={17} />
                  </button>
                </section>
              </div>
              <section className="panel training-options">
                <div className="panel-heading">
                  <div>
                    <h2>Deine Lernrunde</h2>
                    <p>Stelle zusammen, was du üben möchtest.</p>
                  </div>
                  <select
                    aria-label="Anzahl Fragen"
                    value={length}
                    onChange={(e) => setLength(Number(e.target.value))}
                  >
                    <option value={5}>5 Fragen</option>
                    <option value={10}>10 Fragen</option>
                  </select>
                </div>
                <div className="selection-heading">
                  <span>{selectedBirds.length} von 10 Arten ausgewählt</span>
                  <button
                    className="text-button"
                    onClick={() =>
                      setSelectedBirds(
                        selectedBirds.length === birds.length ? [] : birds.map((b) => b.id),
                      )
                    }
                  >
                    {selectedBirds.length === birds.length ? 'Auswahl aufheben' : 'Alle auswählen'}
                  </button>
                </div>
                <div className="species-selection">
                  {birds.map((b) => (
                    <label key={b.id}>
                      <input
                        type="checkbox"
                        checked={selectedBirds.includes(b.id)}
                        onChange={() =>
                          setSelectedBirds(
                            selectedBirds.includes(b.id)
                              ? selectedBirds.filter((id) => id !== b.id)
                              : [...selectedBirds, b.id],
                          )
                        }
                      />
                      {b.name}
                    </label>
                  ))}
                </div>
                <p className="muted small">
                  Für das Quiz mindestens vier Arten auswählen. Fällige und unsichere Arten kommen
                  zuerst.
                </p>
                {notice && (
                  <p role="alert" className="error">
                    {notice}
                  </p>
                )}
              </section>
            </>
          ) : tab === 'progress' ? (
            <>
              <PageHeading
                eyebrow="JEDES ZUHÖREN ZÄHLT"
                title="Dein Gehör wächst mit dir."
                subtitle="Hier siehst du, welche Stimmen dir schon vertraut sind."
              />
              <div className="metric-grid">
                <Metric
                  label="Abgeschlossene Runden"
                  value={String(progress.rounds)}
                  note="In deinem eigenen Tempo"
                  icon={<Headphones size={19} />}
                />
                <Metric
                  label="Trefferquote"
                  value={progress.quizAnswers ? `${accuracy} %` : '–'}
                  note={`${progress.quizCorrect} von ${progress.quizAnswers} richtig im Quiz`}
                  icon={<Target size={19} />}
                />
                <Metric
                  label="Sicher erkannte Arten"
                  value={`${mastered} / 10`}
                  note="Mindestens Lernstufe 3"
                  icon={<CheckCircle2 size={19} />}
                />
              </div>
              {!progress.answers && (
                <div className="notice">
                  <Leaf size={21} />
                  <p>
                    Deine Reise beginnt mit dem ersten Ton. Starte eine Lernrunde, um hier deinen
                    Fortschritt zu sehen.
                  </p>
                </div>
              )}
              <section className="panel progress-list">
                <div className="panel-heading">
                  <div>
                    <h2>Stimme für Stimme</h2>
                    <p>Deine Lernstufen und Wiederholungen</p>
                  </div>
                </div>
                {birds.map((b) => {
                  const p = progress.birds[b.id];
                  return (
                    <button className="progress-row" key={b.id} onClick={() => openBird(b)}>
                      {b.image && <img src={b.image.path} alt="" />}
                      <div className="progress-name">
                        <strong>{b.name}</strong>
                        <span>
                          {p ? `${p.correct} sicher · ${p.wrong} unsicher` : 'Noch nicht geübt'}
                        </span>
                      </div>
                      <div className="progress-bars" aria-label={`Lernstufe ${p?.box || 0} von 5`}>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <i key={n} className={(p?.box || 0) >= n ? 'filled' : ''} />
                        ))}
                      </div>
                      <span className="due-label">
                        {!p
                          ? 'Entdecken'
                          : p.due <= Date.now()
                            ? 'Wiederholen'
                            : `Ab ${new Date(p.due).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })}`}
                      </span>
                      <ChevronRight size={17} />
                    </button>
                  );
                })}
              </section>
              {!!Object.keys(progress.confusions).length && (
                <section className="panel detail-copy">
                  <h2>Hier lohnt sich genaues Hinhören</h2>
                  {Object.entries(progress.confusions)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 3)
                    .map(([key, count]) => {
                      const [a, b] = key.split('|');
                      return (
                        <p key={key}>
                          {birds.find((x) => x.id === a)?.name} →{' '}
                          {birds.find((x) => x.id === b)?.name}: {count}× verwechselt
                        </p>
                      );
                    })}
                </section>
              )}
            </>
          ) : tab === 'settings' ? (
            <>
              <PageHeading
                eyebrow="SO PASST ES ZU DIR"
                title="Deine Einstellungen"
                subtitle="Privat, unkompliziert und auf deinem Gerät."
              />
              <section className="panel detail-copy">
                <h2>Darstellung</h2>
                <div className="settings-row">
                  <span>Dunkler Modus</span>
                  <button
                    className="toggle"
                    aria-label="Dunkler Modus"
                    aria-pressed={theme === 'dark'}
                    onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                  >
                    <i />
                  </button>
                </div>
                <div className="settings-row">
                  <span>Fragen je Runde</span>
                  <select
                    value={length}
                    aria-label="Fragen je Runde"
                    onChange={(e) => setLength(Number(e.target.value))}
                  >
                    <option value={5}>5 Fragen</option>
                    <option value={10}>10 Fragen</option>
                  </select>
                </div>
              </section>
              <section className="panel detail-copy">
                <h2>Deine Daten bleiben bei dir</h2>
                <p>
                  Kein Konto, keine Werbung, keine Analyse-Dienste. Lernfortschritt und
                  Einstellungen werden auf diesem Gerät gespeichert. Bilder, Schrift und
                  Vogelstimmen werden mit der App mitgeliefert.
                </p>
                <p>
                  Quellenlinks öffnen externe Webseiten und benötigen Internet. Beim Löschen der App
                  oder ihrer Daten geht der Lernfortschritt verloren.
                </p>
                <button className="text-button" onClick={() => navigate('sources')}>
                  Quellen & Lizenzen ansehen <ArrowRight size={16} />
                </button>
              </section>
              <section className="panel detail-copy">
                <h2>Neu anfangen</h2>
                <p>Du kannst deinen gesamten Lernfortschritt zurücksetzen.</p>
                <button className="button secondary danger" onClick={() => setConfirmReset(true)}>
                  <RotateCcw size={16} />
                  Fortschritt zurücksetzen
                </button>
              </section>
              <p className="muted small">Vogelstimmen · Version 0.0.1 · Für die private Nutzung</p>
            </>
          ) : (
            <>
              <PageHeading
                eyebrow="ECHTE STIMMEN, SICHTBARE QUELLEN"
                title="Quellen & Lizenzen"
                subtitle="Danke an die Menschen, die Natur hörbar und sichtbar machen."
              />
              <div className="notice">
                <BookOpen size={22} />
                <p>
                  Alle Medien sind lokal enthalten. Die jeweilige Lizenz gilt für die Mediendatei.
                  Quellenlinks führen zur Original-Dateiseite. Aufnahmen wurden anhand der Metadaten
                  ausgewählt; die vollständige fachliche Hörprüfung steht noch aus.
                </p>
              </div>
              {birds.map((b) => (
                <section className="panel sources-card" key={b.id}>
                  <h2>
                    {b.name} <span className="scientific">{b.scientific}</span>
                  </h2>
                  {b.image && (
                    <details>
                      <summary>Foto</summary>
                      <CreditLine credit={b.image} />
                    </details>
                  )}
                  {b.recordings.map((r, i) => (
                    <details key={r.path}>
                      <summary>
                        Aufnahme {i + 1} · {r.kind}
                      </summary>
                      <CreditLine credit={r} />
                      <p className="source-description">{r.description}</p>
                    </details>
                  ))}
                  <details>
                    <summary>Artinformationen</summary>
                    <p>
                      Eigene, zusammenfassende Lerntexte. Artübersicht und weiterführende
                      Informationen:{' '}
                      <a
                        href={`https://de.wikipedia.org/wiki/${encodeURIComponent(b.scientific)}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {b.scientific}
                      </a>
                      . Hörhilfen sind Merksätze und keine vollständige Beschreibung aller
                      Lautäußerungen.
                    </p>
                  </details>
                </section>
              ))}
              <section className="panel detail-copy">
                <h2>Schrift & Software</h2>
                <p>
                  Manrope · Mikhail Sharanda und Mitwirkende · SIL Open Font License 1.1. Die Lizenz
                  ist in der App unter{' '}
                  <a href="/licenses/Manrope-OFL.txt" target="_blank">
                    Manrope-OFL.txt
                  </a>{' '}
                  enthalten.
                </p>
                <p>
                  React, Vite und Lucide · MIT-Lizenz. Capacitor · MIT-Lizenz.{' '}
                  <a href="/licenses/THIRD-PARTY.txt" target="_blank">
                    Software-Lizenztexte
                  </a>
                  .
                </p>
              </section>
            </>
          )}
          <footer className="app-footer">
            <span>
              <Feather size={14} /> Ein bisschen näher an der Natur.
            </span>
            <button onClick={() => navigate('sources')}>Quellen & Lizenzen</button>
          </footer>
        </main>
      </div>
      <nav className="bottom-nav" aria-label="Hauptnavigation">
        {nav.map(({ id, label, icon: Icon }) => (
          <button key={id} className={tab === id ? 'active' : ''} onClick={() => navigate(id)}>
            <Icon size={21} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      {session && (
        <div className="session-overlay">
          <div className="session-container">
            <header className="session-header">
              <span>
                <Feather size={20} />
                {session.mode === 'quiz' ? 'Hörquiz' : 'Hörkarten'}
              </span>
              <button
                className="icon-button"
                aria-label="Lernrunde schließen"
                onClick={() => {
                  stopAudio();
                  session.finished ? setSession(null) : setConfirmExit(true);
                }}
              >
                <X />
              </button>
            </header>
            {session.finished ? (
              <div className="session-result">
                <div className="result-icon">
                  <Leaf size={45} />
                </div>
                <span className="eyebrow">EIN STÜCK WEITER</span>
                <h1>
                  {session.score >= session.questions.length * 0.8
                    ? 'Das klingt schon richtig gut!'
                    : 'Jede Stimme macht dich besser.'}
                </h1>
                <p>
                  Du hast {session.score} von {session.questions.length} Stimmen{' '}
                  {session.mode === 'quiz' ? 'richtig' : 'sicher'} erkannt.
                </p>
                <div className="result-score">
                  {Math.round((session.score / session.questions.length) * 100)}
                  <span>%</span>
                </div>
                <p className="muted">
                  Unsichere Arten werden in kommenden Runden bevorzugt wiederholt.
                </p>
                <button className="button" onClick={() => start(session.mode)}>
                  Noch eine Runde <RotateCcw size={17} />
                </button>
                <button
                  className="text-button"
                  onClick={() => {
                    setSession(null);
                    navigate('progress');
                  }}
                >
                  Meinen Fortschritt ansehen <ArrowRight size={16} />
                </button>
              </div>
            ) : (
              (() => {
                const q = session.questions[session.index],
                  r = q.bird.recordings[q.recording],
                  correct = session.selected === q.bird.id;
                return (
                  <>
                    <div className="session-meta">
                      <span>
                        Frage {session.index + 1} von {session.questions.length}
                      </span>
                      <span>
                        {session.score} {session.mode === 'quiz' ? 'richtig' : 'sicher'}
                      </span>
                    </div>
                    <div className="session-track">
                      <span
                        style={{ width: `${(session.index / session.questions.length) * 100}%` }}
                      />
                    </div>
                    <div className="question-heading">
                      <span className="eyebrow">NIMM DIR EINEN MOMENT</span>
                      <h1>
                        {session.mode === 'quiz' ? 'Wer singt denn da?' : 'Kennst du diese Stimme?'}
                      </h1>
                      <p>Hör genau hin. Du kannst die Aufnahme beliebig oft abspielen.</p>
                    </div>
                    <AudioPlayer
                      key={`${session.index}-${r.path}`}
                      recording={r}
                      concealed={!session.revealed}
                      onPlayed={() => setSession((s) => (s ? { ...s, played: true } : s))}
                    />
                    {session.mode === 'quiz' ? (
                      <div className="answers">
                        {q.options.map((id, i) => {
                          const b = birds.find((b) => b.id === id)!;
                          return (
                            <button
                              disabled={!session.played || session.selected !== null}
                              className={`answer ${session.selected !== null ? (id === q.bird.id ? 'correct' : id === session.selected ? 'wrong' : '') : ''}`}
                              key={id}
                              onClick={() => answer(id, id === q.bird.id)}
                            >
                              <span className="answer-letter">{String.fromCharCode(65 + i)}</span>
                              {b.name}
                              {session.selected !== null && id === q.bird.id && <Check size={20} />}
                            </button>
                          );
                        })}
                      </div>
                    ) : !session.revealed ? (
                      <button
                        className="button reveal-button"
                        disabled={!session.played}
                        onClick={() => setSession({ ...session, revealed: true })}
                      >
                        Art aufdecken <ArrowRight size={17} />
                      </button>
                    ) : null}
                    {!session.played && (
                      <p className="muted small centered">Spiele zuerst die Aufnahme ab.</p>
                    )}
                    {session.revealed && (
                      <div
                        className={`feedback ${session.mode === 'learn' || correct ? 'positive' : 'negative'}`}
                        role="status"
                      >
                        <span className="eyebrow">
                          {session.mode === 'learn'
                            ? 'DAS IST DIESE ART'
                            : correct
                              ? 'RICHTIG ERKANNT'
                              : 'DAS WAR EINE ANDERE STIMME'}
                        </span>
                        <h2>{q.bird.name}</h2>
                        <p>{q.bird.voice}</p>
                        <div className="mnemonic">
                          <Feather size={18} />
                          <p>{q.bird.mnemonic}</p>
                        </div>
                        {session.mode === 'learn' && session.selected === null ? (
                          <>
                            <p>Wie sicher warst du?</p>
                            <div className="rating-buttons">
                              <button
                                className="button secondary"
                                onClick={() => answer('unsicher', false)}
                              >
                                Noch unsicher
                              </button>
                              <button className="button" onClick={() => answer(q.bird.id, true)}>
                                Sicher erkannt <Check size={17} />
                              </button>
                            </div>
                          </>
                        ) : (
                          <button className="button" onClick={next}>
                            {session.index === session.questions.length - 1
                              ? 'Ergebnis ansehen'
                              : 'Nächste Stimme'}
                            <ArrowRight size={17} />
                          </button>
                        )}
                        <details className="audio-credit">
                          <summary>Mehr zur Unterscheidung</summary>
                          <p>{q.bird.compare}</p>
                        </details>
                      </div>
                    )}
                  </>
                );
              })()
            )}
          </div>
        </div>
      )}
      {(confirmReset || confirmExit) && (
        <div className="modal-backdrop">
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label={confirmReset ? 'Fortschritt zurücksetzen' : 'Runde beenden'}
          >
            <h2>{confirmReset ? 'Wirklich neu anfangen?' : 'Lernrunde beenden?'}</h2>
            <p>
              {confirmReset
                ? 'Deine Antworten, Lernstufen und Statistiken werden auf diesem Gerät gelöscht.'
                : 'Bereits beantwortete Fragen bleiben gespeichert. Diese Runde wird nicht als abgeschlossen gezählt.'}
            </p>
            <div className="rating-buttons">
              <button
                autoFocus
                className="button secondary"
                onClick={() => {
                  setConfirmReset(false);
                  setConfirmExit(false);
                }}
              >
                Abbrechen
              </button>
              <button
                className="button"
                onClick={() => {
                  if (confirmReset) setProgress(emptyProgress());
                  if (confirmExit) {
                    stopAudio();
                    setSession(null);
                  }
                  setConfirmReset(false);
                  setConfirmExit(false);
                }}
              >
                {confirmReset ? 'Zurücksetzen' : 'Runde beenden'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
function PageHeading({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="page-heading">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
    </div>
  );
}
function Metric({
  label,
  value,
  note,
  icon,
}: {
  label: string;
  value: string;
  note: string;
  icon: React.ReactNode;
}) {
  return (
    <section className="panel metric">
      <div>
        <span>{label}</span>
        {icon}
      </div>
      <strong>{value}</strong>
      <p>{note}</p>
    </section>
  );
}
function BirdCard({
  bird,
  onClick,
  progress,
}: {
  bird: Bird;
  onClick: () => void;
  progress: Progress;
}) {
  return (
    <button className="bird-card" onClick={onClick}>
      <div className="bird-image">
        {bird.image ? (
          <img src={bird.image.path} alt={bird.name} loading="lazy" />
        ) : (
          <BirdIcon size={50} />
        )}
        <span>{bird.level}</span>
      </div>
      <div className="bird-card-copy">
        <div>
          <h3>{bird.name}</h3>
          <ChevronRight size={17} />
        </div>
        <p>{bird.scientific}</p>
        <span className="bird-card-meta">
          <Headphones size={13} />
          {bird.recordings.length} Hörbeispiele
          <span>{progress.birds[bird.id]?.seen ? 'Schon entdeckt' : 'Entdecken'}</span>
        </span>
      </div>
    </button>
  );
}
