import { isValidCep, isValidCpf, isValidPhone, onlyDigits } from './br-documents';

describe('br-documents', () => {
  it('validates CPF check digits, with or without punctuation', () => {
    expect(isValidCpf('529.982.247-25')).toBe(true);
    expect(isValidCpf('52998224725')).toBe(true);
    expect(isValidCpf('529.982.247-24')).toBe(false);
    expect(isValidCpf('111.111.111-11')).toBe(false);
    expect(isValidCpf('5299822472')).toBe(false);
    expect(isValidCpf('52998224a25')).toBe(false);
  });

  it('accepts phones with area code (10 or 11 digits)', () => {
    expect(isValidPhone('(11) 98765-4321')).toBe(true);
    expect(isValidPhone('(11) 3456-7890')).toBe(true);
    expect(isValidPhone('98765-4321')).toBe(false);
  });

  it('accepts CEPs with 8 digits', () => {
    expect(isValidCep('01310-100')).toBe(true);
    expect(isValidCep('0131010')).toBe(false);
    expect(onlyDigits('01310-100')).toBe('01310100');
  });
});
