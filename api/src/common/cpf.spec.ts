import { isValidCpf, maskCpf, normalizeCpf } from './cpf.js';

describe('cpf', () => {
  it('accepts valid CPFs with or without punctuation', () => {
    expect(isValidCpf('52998224725')).toBe(true);
    expect(isValidCpf('529.982.247-25')).toBe(true);
    expect(isValidCpf('111.444.777-35')).toBe(true);
  });

  it('rejects wrong check digits, wrong length, repeated digits and letters', () => {
    expect(isValidCpf('52998224724')).toBe(false);
    expect(isValidCpf('52998224715')).toBe(false);
    expect(isValidCpf('5299822472')).toBe(false);
    expect(isValidCpf('529982247250')).toBe(false);
    expect(isValidCpf('11111111111')).toBe(false);
    expect(isValidCpf('5299822472a')).toBe(false);
    expect(isValidCpf('')).toBe(false);
  });

  it('normalizes punctuation only', () => {
    expect(normalizeCpf(' 529.982.247-25 ')).toBe('52998224725');
    expect(normalizeCpf('529/982')).toBe('529/982');
  });

  it('masks all but the middle digits', () => {
    expect(maskCpf('52998224725')).toBe('***.982.247-**');
    expect(maskCpf('123')).toBe('***');
  });
});
