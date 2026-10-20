import { describe, expect, it } from 'vitest';
import { emptyProgress, makeQueue, shuffle, updateAnswer } from './learning';
describe('Lernfortschritt', () => {
  it('merkt Fehler und Verwechslungen und macht die Art sofort wieder fällig', () => {
    const result = updateAnswer(emptyProgress(), 'amsel', false, 'singdrossel', '/test.mp3', 1000);
    expect(result.birds.amsel).toMatchObject({
      seen: 1,
      correct: 0,
      wrong: 1,
      box: 0,
      due: 1000,
      lastRecording: '/test.mp3',
    });
    expect(result.confusions['amsel|singdrossel']).toBe(1);
    expect(result.answers).toBe(1);
    expect(result.correct).toBe(0);
  });
  it('verlängert Wiederholungsabstände und setzt sie nach einem Fehler zurück', () => {
    let p = emptyProgress();
    for (let i = 0; i < 8; i++) p = updateAnswer(p, 'amsel', true, 'amsel', undefined, 1000);
    expect(p.birds.amsel.box).toBe(5);
    expect(p.birds.amsel.due).toBe(1000 + 30 * 86400000);
    const failed = updateAnswer(p, 'amsel', false, 'singdrossel', undefined, 2000);
    expect(failed.birds.amsel.box).toBe(0);
    expect(failed.birds.amsel.due).toBe(2000);
    expect(p.birds.amsel.box).toBe(5);
  });
  it('priorisiert fällige Arten vor späteren Wiederholungen', () => {
    let p = updateAnswer(emptyProgress(), 'amsel', true, 'amsel', undefined, 1000);
    p = updateAnswer(p, 'singdrossel', false, 'amsel', undefined, 1000);
    const q = makeQueue(['amsel', 'singdrossel', 'zilpzalp'], p, 5, 2000);
    expect(q).toHaveLength(5);
    expect(q.indexOf('amsel')).toBe(2);
    expect(q.slice(0, 2).sort()).toEqual(['singdrossel', 'zilpzalp']);
    expect(makeQueue([], p, 10)).toEqual([]);
  });
  it('mischt ohne die Eingabe zu verändern oder Elemente zu verlieren', () => {
    const ids = ['a', 'b', 'c', 'd'];
    expect(shuffle(ids, () => 0.3).sort()).toEqual(ids);
    expect(ids).toEqual(['a', 'b', 'c', 'd']);
  });
  it('zählt Selbstbewertungen zu Lernstufen, aber nicht zur Quiz-Trefferquote', () => {
    const p = updateAnswer(emptyProgress(), 'amsel', true, undefined, '/a.mp3', 1000, false);
    expect(p.answers).toBe(1);
    expect(p.birds.amsel.box).toBe(1);
    expect(p.quizAnswers).toBe(0);
    expect(p.quizCorrect).toBe(0);
    expect(p.confusions).toEqual({});
  });
});
