import { scoreTone } from './score-chip.component';

describe('score chip boundaries', () => {
  for (const [score, tone] of [
    [null, 'neutral'],
    [0, 'danger'],
    [0.399, 'danger'],
    [0.4, 'warning'],
    [0.699, 'warning'],
    [0.7, 'success'],
    [1, 'success'],
  ] as const) {
    it(`maps ${score} to ${tone}`, () => expect(scoreTone(score)).toBe(tone));
  }
});
