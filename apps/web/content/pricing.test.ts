import { test, expect } from 'bun:test';
import { estimate } from './pricing';

test('sous 10 000 minutes on reste sur Free', () => {
  expect(estimate(0, 'monthly').plan).toBe('Free');
  expect(estimate(9_999, 'monthly').plan).toBe('Free');
  expect(estimate(10_000, 'monthly').plan).toBe('Free');
  expect(estimate(10_000, 'monthly').cost).toBe('€0');
});

test('Free est un hard stop : pas d overage facture', () => {
  expect(estimate(10_000, 'monthly').note).toContain('new rooms are refused');
});

test('juste au-dessus de la limite Free on bascule sur Starter a sa base', () => {
  const e = estimate(10_001, 'monthly');
  expect(e.plan).toBe('Starter');
  expect(e.cost).toBe('€49');
});

test('Starter inclut 50 000 minutes, donc rien au-dessus de la base', () => {
  expect(estimate(50_000, 'monthly').cost).toBe('€49');
});

test('au-dela de 50 000 minutes Starter facture l overage a 0,0012', () => {
  // 49 + 70 000 * 0.0012 = 133
  expect(estimate(120_000, 'monthly').cost).toBe('€133');
});

test('a l egalite exacte Starter l emporte sur Scale', () => {
  // 49 + 375 000 * 0.0012 = 499 = base Scale
  const e = estimate(425_000, 'monthly');
  expect(e.plan).toBe('Starter');
  expect(e.cost).toBe('€499');
});

test('une minute plus loin Scale devient moins cher', () => {
  const e = estimate(425_001, 'monthly');
  expect(e.plan).toBe('Scale');
  expect(e.cost).toBe('€499');
});

test('au-dela de 500 000 minutes Scale facture l overage a 0,0009', () => {
  // 499 + 700 000 * 0.0009 = 1129
  const e = estimate(1_200_000, 'monthly');
  expect(e.plan).toBe('Scale');
  expect(e.cost).toBe('€1,129');
});

test('au-dela de 1,2M de minutes on bascule sur Business', () => {
  const e = estimate(1_200_001, 'monthly');
  expect(e.plan).toBe('Business');
  expect(e.cost).toBe('Custom');
});

test('en annuel les bases sont 39 et 399', () => {
  expect(estimate(10_001, 'annual').cost).toBe('€39');
  // 39 + 300 000 * 0.0012 = 399 = base Scale annuelle, egalite -> Starter
  const tie = estimate(350_000, 'annual');
  expect(tie.plan).toBe('Starter');
  expect(tie.cost).toBe('€399');
  expect(estimate(350_001, 'annual').plan).toBe('Scale');
});

test('la note cite le cout du plan concurrent', () => {
  const e = estimate(1_200_000, 'monthly');
  expect(e.note).toContain('Starter would cost €1,429');
});
