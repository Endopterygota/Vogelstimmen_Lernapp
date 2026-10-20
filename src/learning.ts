export type BirdProgress = {
  seen: number;
  correct: number;
  wrong: number;
  box: number;
  due: number;
  lastRecording?: string;
};
export type Progress = {
  birds: Record<string, BirdProgress>;
  rounds: number;
  answers: number;
  correct: number;
  quizAnswers: number;
  quizCorrect: number;
  confusions: Record<string, number>;
};
export const emptyProgress = (): Progress => ({
  birds: {},
  rounds: 0,
  answers: 0,
  correct: 0,
  quizAnswers: 0,
  quizCorrect: 0,
  confusions: {},
});
export function readProgress(): Progress {
  try {
    const value = JSON.parse(localStorage.getItem('vogelstimmen.progress.v1') || 'null');
    if (
      !value ||
      !value.birds ||
      typeof value.birds !== 'object' ||
      !Number.isFinite(value.answers) ||
      !Number.isFinite(value.correct) ||
      !Number.isFinite(value.rounds) ||
      !value.confusions
    )
      return emptyProgress();
    for (const p of Object.values(value.birds) as BirdProgress[])
      if (![p.seen, p.correct, p.wrong, p.box, p.due].every(Number.isFinite))
        return emptyProgress();
    return {
      ...value,
      quizAnswers: Number.isFinite(value.quizAnswers) ? value.quizAnswers : 0,
      quizCorrect: Number.isFinite(value.quizCorrect) ? value.quizCorrect : 0,
    };
  } catch {
    return emptyProgress();
  }
}
export function updateAnswer(
  progress: Progress,
  id: string,
  correct: boolean,
  selected?: string,
  recording?: string,
  now = Date.now(),
  isQuiz = true,
): Progress {
  const old = progress.birds[id] || { seen: 0, correct: 0, wrong: 0, box: 0, due: 0 };
  const box = correct ? Math.min(5, old.box + 1) : 0;
  const delays = [0, 1, 3, 7, 14, 30];
  const key = selected && selected !== id ? `${id}|${selected}` : null;
  return {
    ...progress,
    answers: progress.answers + 1,
    correct: progress.correct + Number(correct),
    quizAnswers: progress.quizAnswers + Number(isQuiz),
    quizCorrect: progress.quizCorrect + Number(isQuiz && correct),
    confusions: key
      ? { ...progress.confusions, [key]: (progress.confusions[key] || 0) + 1 }
      : progress.confusions,
    birds: {
      ...progress.birds,
      [id]: {
        seen: old.seen + 1,
        correct: old.correct + Number(correct),
        wrong: old.wrong + Number(!correct),
        box,
        due: now + delays[box] * 86400000,
        lastRecording: recording,
      },
    },
  };
}
export function shuffle<T>(items: readonly T[], random = Math.random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
export function makeQueue(
  ids: string[],
  progress: Progress,
  length: number,
  now = Date.now(),
): string[] {
  const ranked = shuffle(ids).sort((a, b) => {
    const pa = progress.birds[a],
      pb = progress.birds[b];
    return (
      Number(!!pa && pa.due > now) - Number(!!pb && pb.due > now) || (pa?.box || 0) - (pb?.box || 0)
    );
  });
  if (!ranked.length) return [];
  return Array.from({ length }, (_, i) => ranked[i % ranked.length]);
}
