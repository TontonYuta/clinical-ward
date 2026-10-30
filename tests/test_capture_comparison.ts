import { chromium } from 'playwright';
import path from 'path';

const ARTIFACT_DIR = '/home/tontonyuta/.gemini/antigravity-cli/brain/4039af10-628e-47df-bee0-0357f9f93312';

async function captureComparisonTabs() {
  const browser = await chromium.launch({ headless: true });

  const desktopCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await desktopCtx.addInitScript(() => { localStorage.setItem('clinical_user_role', 'pharmacist'); });
  const page = await desktopCtx.newPage();

  await page.goto('http://localhost:3001/#debt', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'compare_debt_desktop.png') });

  await page.goto('http://localhost:3001/#fefo', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'compare_fefo_desktop.png') });

  await page.goto('http://localhost:3001/#equipment', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'compare_equipment_desktop.png') });

  await desktopCtx.close();
  await browser.close();
  console.log('✅ Captured comparison tabs');
}

captureComparisonTabs().catch(console.error);
