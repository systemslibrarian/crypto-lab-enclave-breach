import { expect, test, type Page } from '@playwright/test';
import { boot } from './gate';

/**
 * The claims suite (§4.1b): what the page SAYS, re-derived here. The trace is rebuilt
 * from the exponent with the brief's rule, and the exponentiation is recomputed with
 * BigInt by a separate algorithm.
 */
const traceOf = (e: bigint): string => (e <= 1n ? '' : [...e.toString(2).slice(1)].map((b) => (b === '1' ? 'SM' : 'S')).join(''));
const powmod = (b: bigint, e: bigint, m: bigint): bigint => {
  let r = 1n;
  b %= m;
  for (const bit of e.toString(2)) {
    r = (r * r) % m;
    if (bit === '1') r = (r * b) % m;
  }
  return r;
};

async function openTab(page: Page, name: RegExp): Promise<void> {
  await page.getByRole('tab', { name }).click();
  await expect(page.getByRole('tab', { name })).toHaveAttribute('aria-selected', 'true');
}
async function runExp(page: Page, hex: string): Promise<void> {
  await openTab(page, /The enclave program/);
  await page.locator('#prog-exp').fill(hex);
  await page.locator('#prog-run').click();
}
const text = async (page: Page, sel: string) => (await page.locator(sel).first().innerText()).trim();

test.describe('displayed claims', () => {
  test('the default exponent 0b10110101 gives the trace S S M S M S S M S S M, and the result matches BigInt recomputed here', async ({ page }) => {
    await boot(page, 'dark');
    await openTab(page, /The enclave program/);
    const base = BigInt(await page.locator('#prog-base').inputValue());
    const mod = BigInt(await page.locator('#prog-mod').inputValue());
    expect(await page.locator('#prog-exp').inputValue()).toBe('b5');
    await expect(page.locator('[data-claim="prog-result"]')).toHaveText(powmod(base, 0xb5n, mod).toString());
    await openTab(page, /The OS view/);
    expect(traceOf(0b10110101n)).toBe('SSMSMSSMSSM');
    await expect(page.locator('[data-claim="os-sm-text"]')).toHaveText('SSMSMSSMSSM');
  });

  test('a 64-bit exponent: the OS trace is the brief\'s rule applied to it, and recovery rebuilds every bit', async ({ page }) => {
    await boot(page, 'dark');
    const e = 0xc0ffee1234abcdefn;
    await runExp(page, e.toString(16));
    await openTab(page, /The OS view/);
    await expect(page.locator('[data-claim="os-sm-text"]')).toHaveText(traceOf(e));
    await openTab(page, /Recover the exponent/);
    await expect(page.locator('[data-claim="rec-bits"]')).toHaveText(e.toString(2));
  });

  test('the negative claim: memory sealed, arithmetic correct, and the key read from its footsteps', async ({ page }) => {
    await boot(page, 'dark');
    await openTab(page, /Recover the exponent/);
    const fixture = page.locator('#breach-fixture');
    // 1. Reached.
    await expect(fixture).toBeVisible();
    // 2. Every check in the fixture passes.
    const oks = await fixture.locator('[data-check]').evaluateAll((els) => els.map((e) => e.getAttribute('data-ok')));
    expect(oks).toEqual(['true', 'true', 'true']);
    expect(await text(page, '[data-claim="rec-bits"]')).toBe(await text(page, '[data-claim="rec-truth"]'));
    await expect(fixture.locator('.verdict-alarm')).toContainText('MEMORY SEALED — AND THE KEY READ FROM ITS FOOTSTEPS');
    // 3. The limitation is on screen, in that state, tied to the fixture.
    const claim = fixture.locator('[data-negative-claim="breach"]');
    await expect(claim).toBeVisible();
    await expect(claim).toContainText('The enclave\'s memory was never read, and its arithmetic is correct. The exponent leaked anyway, through which pages it used — and the fix is page-oblivious in this model, not constant-time.');
  });

  test('a truncated trace: the leading bits are right and the tail is reported unknown', async ({ page }) => {
    await boot(page, 'dark');
    await openTab(page, /Recover the exponent/);
    await page.locator('#rec-loss').selectOption('12');
    const bits = (await text(page, '[data-claim="rec-bits"]')).replace('…', '');
    expect('10110101'.startsWith(bits)).toBe(true);
    expect(bits.length).toBeLessThan(8);
    await expect(page.locator('#rec-out .verdict-alarm')).toContainText('unknown');
    await expect(page.locator('#breach-fixture')).toHaveCount(0);
  });

  test('exponent 0: no square or multiply ran, and the page says there is nothing to recover', async ({ page }) => {
    await boot(page, 'dark');
    await runExp(page, '0');
    await openTab(page, /The OS view/);
    await expect(page.locator('[data-claim="os-sm-text"]')).toHaveText('(none)');
    await openTab(page, /Recover the exponent/);
    await expect(page.locator('#rec-out')).toContainText('nothing more to recover');
  });

  test('the oblivious rewrite: 128 steps, identical to the traces for 0 and 2^64 − 1, correct, and no information', async ({ page }) => {
    await boot(page, 'dark');
    await openTab(page, /Oblivious rewrite/);
    await page.locator('#obl-run').click();
    await expect(page.locator('[data-claim="obl-steps"]')).toHaveText('128');
    const oks = await page.locator('#obl-out [data-check]').evaluateAll((els) => els.map((e) => e.getAttribute('data-ok')));
    expect(oks).toEqual(['true', 'true', 'true', 'true']);
    const row = (await page.locator('#obl-sm .tok-name').allInnerTexts()).join('');
    expect(row).toBe('SM'.repeat(64));
  });

  test('an exponent wider than 64 bits: the oblivious version refuses', async ({ page }) => {
    await boot(page, 'dark');
    await runExp(page, '1' + '0'.repeat(16));
    await openTab(page, /Oblivious rewrite/);
    await page.locator('#obl-run').click();
    await expect(page.locator('#obl-out .verdict-fail')).toContainText('wider than 64');
  });

  test('Xu et al.\'s login counter: with separate pages the OS counts equal the true counts; with a shared page it sees only the total', async ({ page }) => {
    await boot(page, 'dark');
    await openTab(page, /Xu et al/);
    await page.locator('#login-run').click();
    expect(await text(page, '[data-claim="login-os-m"]')).toBe(await text(page, '[data-claim="login-true-m"]'));
    expect(await text(page, '[data-claim="login-os-f"]')).toBe(await text(page, '[data-claim="login-true-f"]'));
    const before = await text(page, '[data-claim="login-true-m"]');
    await page.locator('#login-layout').selectOption('shared');
    await expect(page.locator('[data-claim="login-true-m"]')).toHaveText(before);
    await expect(page.locator('#login-out .verdict-pass')).toBeVisible();
    const total = Number(await text(page, '[data-claim="login-true-m"]')) + Number(await text(page, '[data-claim="login-true-f"]'));
    expect(Number(await text(page, '[data-claim="login-os-m"]'))).toBe(total);
    await expect(page.locator('[data-claim="login-os-f"]')).toHaveText('0');
  });

  test('changing the exponent replaces the recovery: the fixture follows the new run', async ({ page }) => {
    await boot(page, 'dark');
    await runExp(page, '3');
    await openTab(page, /Recover the exponent/);
    await expect(page.locator('[data-claim="rec-truth"]')).toHaveText('11');
    await expect(page.locator('[data-claim="rec-bits"]')).toHaveText('11');
  });
});
