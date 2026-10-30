import { chromium } from 'playwright';

async function main() {
  console.log('--- Verifying DDI Pure RAG Integration on http://localhost:3001 ---');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  try {
    await page.goto('http://localhost:3001', { waitUntil: 'networkidle', timeout: 15000 });

    const input = page.locator('[data-testid="chat-input-field"]');
    if (await input.count() === 0 || !(await input.isVisible())) {
      await page.keyboard.press('Control+k');
      await page.waitForTimeout(600);
    }

    const query = 'Ceftriaxon kết hợp với Calci có nguy cơ tương tác và chống chỉ định không?';
    await input.fill(query);
    await input.press('Enter');

    // Wait for agent response
    await page.waitForTimeout(4000);

    const ragBadge = page.locator('text=RAG Xác thực');
    console.log('RAG Badge visible:', await ragBadge.count() > 0);

    await page.screenshot({ path: 'rag_ddi_interaction_ui_success.png', fullPage: false });
    console.log('✅ Screenshot captured: rag_ddi_interaction_ui_success.png');
  } catch (err) {
    console.error('Playwright error:', err);
  } finally {
    await browser.close();
  }
}

main();
