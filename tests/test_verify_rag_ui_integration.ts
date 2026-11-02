import { chromium } from 'playwright';

const ARTIFACT_PATH = '/home/tontonyuta/.gemini/antigravity-cli/brain/4039af10-628e-47df-bee0-0357f9f93312/rag_ddi_interaction_ui_success.png';

async function main() {
  console.log('--- Verifying DDI Pure RAG Integration & Citation Disclosure on http://localhost:3001 ---');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  try {
    await page.goto('http://localhost:3001', { waitUntil: 'domcontentloaded', timeout: 15000 });

    const input = page.locator('[data-testid="chat-input-field"]');
    if (await input.count() === 0 || !(await input.isVisible())) {
      await page.keyboard.press('Control+k');
      await page.waitForTimeout(600);
    }

    const query = 'Ceftriaxon kết hợp với Calci có nguy cơ tương tác và chống chỉ định không?';
    await input.fill(query);
    await input.press('Enter');

    // Wait for agent response
    await page.waitForSelector('[data-testid="chat-message-agent"]', { timeout: 15000 });
    await page.waitForTimeout(2000);

    const sourceIntro = page.locator('[data-testid="chat-source-introduction"]').first();
    const isSourceIntroVisible = await sourceIntro.isVisible().catch(() => false);
    console.log('Source Introduction visible:', isSourceIntroVisible);

    const details = page.locator('details').first();
    const isDetailsVisible = await details.isVisible().catch(() => false);
    console.log('Citation Details disclosure visible:', isDetailsVisible);

    if (isDetailsVisible) {
      await details.locator('summary').click();
      await page.waitForTimeout(500);
      const excerpt = details.locator('blockquote');
      const pdfLink = details.locator('a:has-text("Mở tài liệu gốc")');
      console.log('Excerpt visible:', await excerpt.isVisible().catch(() => false));
      console.log('PDF Link href:', await pdfLink.getAttribute('href').catch(() => null));
    }

    await page.screenshot({ path: ARTIFACT_PATH, fullPage: false });
    console.log('✅ Screenshot captured:', ARTIFACT_PATH);
  } catch (err) {
    console.error('Playwright error:', err);
    throw err;
  } finally {
    await browser.close();
  }
}

main();
