'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright-core');

const CHROME = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE_URL = process.env.PREVIEW_URL || 'http://127.0.0.1:3000/';
const OUT_DIR = path.join(__dirname, '..', 'preview');

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const sizes = [
    { name: 'desktop', width: 1440, height: 1000 },
    { name: 'tablet', width: 900, height: 1100 },
    { name: 'mobile', width: 390, height: 844 },
  ];

  for (const size of sizes) {
    const context = await browser.newContext({
      viewport: { width: size.width, height: size.height },
      deviceScaleFactor: 1,
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    const errors = [];
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);

    const metrics = await page.evaluate(() => ({
      innerWidth: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      rows: document.querySelectorAll('.job-row:not([hidden])').length,
      totalRows: document.querySelectorAll('.job-row').length,
      result: document.getElementById('result-count')?.textContent,
    }));

    await page.screenshot({ path: path.join(OUT_DIR, `${size.name}-full.png`), fullPage: true });
    await page.locator('#ledger').screenshot({ path: path.join(OUT_DIR, `${size.name}-ledger.png`) });

    console.log(size.name, metrics, errors.length ? { errors } : 'no console errors');
    await context.close();
  }

  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });

  await page.getByRole('button', { name: /Administrators/ }).click();
  const afterCategory = await page.evaluate(() => ({
    visible: document.querySelectorAll('.job-row:not([hidden])').length,
    result: document.getElementById('result-count')?.textContent,
  }));
  await page.locator('#job-search').fill('Brussels');
  await page.waitForTimeout(250);
  const afterSearch = await page.evaluate(() => ({
    visible: document.querySelectorAll('.job-row:not([hidden])').length,
    result: document.getElementById('result-count')?.textContent,
  }));
  await page.getByRole('button', { name: 'Reset' }).click();
  const afterReset = await page.evaluate(() => ({
    visible: document.querySelectorAll('.job-row:not([hidden])').length,
    result: document.getElementById('result-count')?.textContent,
  }));
  console.log('interaction', { afterCategory, afterSearch, afterReset });

  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
