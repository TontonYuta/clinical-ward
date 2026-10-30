import { chromium } from 'playwright';
import path from 'path';

const ARTIFACT_DIR = '/home/tontonyuta/.gemini/antigravity-cli/brain/4039af10-628e-47df-bee0-0357f9f93312';

async function captureCurrentColdChain() {
  const browser = await chromium.launch({ headless: true });

  // 1. Desktop
  const desktopCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await desktopCtx.addInitScript(() => { localStorage.setItem('clinical_user_role', 'pharmacist'); });
  const desktopPage = await desktopCtx.newPage();
  await desktopPage.goto('http://localhost:3001/#coldchain', { waitUntil: 'networkidle' });
  await desktopPage.waitForTimeout(1000);
  await desktopPage.screenshot({ path: path.join(ARTIFACT_DIR, 'coldchain_before_desktop.png') });
  console.log('✅ Captured coldchain_before_desktop.png');
  await desktopCtx.close();

  // 2. Mobile
  const mobileCtx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true
  });
  await mobileCtx.addInitScript(() => { localStorage.setItem('clinical_user_role', 'pharmacist'); });
  const mobilePage = await mobileCtx.newPage();
  await mobilePage.goto('http://localhost:3001/#coldchain', { waitUntil: 'networkidle' });
  await mobilePage.waitForTimeout(1000);
  await mobilePage.screenshot({ path: path.join(ARTIFACT_DIR, 'coldchain_before_mobile.png') });
  console.log('✅ Captured coldchain_before_mobile.png');
  await mobileCtx.close();

  await browser.close();
}

captureCurrentColdChain().catch(err => {
  console.error(err);
  process.exit(1);
});
