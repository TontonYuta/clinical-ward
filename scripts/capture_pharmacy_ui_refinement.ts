import { chromium } from 'playwright';
import path from 'path';

async function captureScreenshots() {
  const browser = await chromium.launch({ headless: true });
  const outputDir = path.resolve('/home/tontonyuta/Downloads/DoAn2/artifacts/ui');

  // 1. Desktop (1440x900)
  const desktopPage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await desktopPage.goto('http://localhost:5173/#fefo', { waitUntil: 'networkidle' });
  await desktopPage.waitForTimeout(1000);

  // Navigate to Pharmacy tab
  const pharmacyTabs = desktopPage.locator('aside button:has-text("Kho dược")');
  for (let i = 0; i < await pharmacyTabs.count(); i++) {
    if (await pharmacyTabs.nth(i).isVisible()) {
      await pharmacyTabs.nth(i).click();
      break;
    }
  }
  await desktopPage.waitForTimeout(800);

  // Screenshot 1: Desktop Pharmacy Tab
  await desktopPage.screenshot({ path: path.join(outputDir, '01_pharmacy_desktop.png'), fullPage: false });
  console.log('Saved 01_pharmacy_desktop.png');

  // Open National Registry Modal
  const nationalRegistryBtn = desktopPage.locator('button[data-testid="btn-open-national-registry"]');
  await nationalRegistryBtn.click();
  await desktopPage.waitForTimeout(1000);

  // Screenshot 2: Desktop Registry Modal
  await desktopPage.screenshot({ path: path.join(outputDir, '02_national_registry_desktop.png'), fullPage: false });
  console.log('Saved 02_national_registry_desktop.png');

  // Perform search & group filter
  const searchInput = desktopPage.locator('input[aria-label="Tìm trong Kho Dược Quốc Gia"]').or(desktopPage.locator('input[placeholder*="Tìm"]')).first();
  await searchInput.fill('Paracetamol');
  await desktopPage.waitForTimeout(600);

  // Toggle filter
  const inWarehouseBtn = desktopPage.locator('button:has-text("Kho bệnh viện")').first();
  if (await inWarehouseBtn.isVisible()) {
    await inWarehouseBtn.click();
    await desktopPage.waitForTimeout(500);
  }

  // Screenshot 3: Desktop Registry Search & Filter
  await desktopPage.screenshot({ path: path.join(outputDir, '03_national_registry_search_desktop.png'), fullPage: false });
  console.log('Saved 03_national_registry_search_desktop.png');

  await desktopPage.close();

  // 2. Mobile (390x844 - iPhone 12/13/14)
  const mobilePage = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
  await mobilePage.goto('http://localhost:5173/#fefo', { waitUntil: 'networkidle' });
  await mobilePage.waitForTimeout(1000);

  // Open mobile menu if needed or directly navigate
  await mobilePage.screenshot({ path: path.join(outputDir, '04_pharmacy_mobile.png'), fullPage: false });
  console.log('Saved 04_pharmacy_mobile.png');

  // Open National Registry
  const mobileRegBtn = mobilePage.locator('button[data-testid="btn-open-national-registry"]');
  if (await mobileRegBtn.isVisible()) {
    await mobileRegBtn.click();
    await mobilePage.waitForTimeout(1000);
    await mobilePage.screenshot({ path: path.join(outputDir, '05_national_registry_mobile.png'), fullPage: false });
    console.log('Saved 05_national_registry_mobile.png');
  }

  await mobilePage.close();
  await browser.close();
  console.log('All screenshots captured successfully in', outputDir);
}

captureScreenshots().catch(err => {
  console.error(err);
  process.exit(1);
});
