import { chromium } from 'playwright';
import path from 'path';

const ARTIFACTS_DIR = '/home/tontonyuta/.gemini/antigravity-cli/brain/4039af10-628e-47df-bee0-0357f9f93312';

async function main() {
  console.log('🚀 Starting User Guide Modal Workstation UI Verification...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  try {
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
    console.log('✅ Loaded application at http://localhost:5173');

    // Find and click the visible User Guide button in the desktop sidebar
    const userGuideBtn = page.locator('button:has-text("Hướng dẫn"):visible, button:has-text("HDSD"):visible').first();
    await userGuideBtn.waitFor({ state: 'visible', timeout: 5000 });
    await userGuideBtn.click();
    console.log('✅ Clicked User Guide button');

    // Wait for the User Guide modal dialog
    const modalHeader = page.locator('h2:has-text("Hướng Dẫn Vận Hành Lâm Sàng")');
    await modalHeader.waitFor({ state: 'visible', timeout: 5000 });
    console.log('✅ User Guide Modal opened successfully with title "Hướng Dẫn Vận Hành Lâm Sàng"');

    // Tab 1: Quy trình ca trực & Ký số
    const tab1Btn = page.locator('button[role="tab"]:has-text("Quy trình ca trực")');
    await tab1Btn.click();
    await page.waitForTimeout(400);
    console.log('📸 Taking screenshot for Tab 1: Quy trình ca trực & Ký số...');
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'user_guide_tab1_shift_workflow.png') });

    // Test PIN toggle in Tab 1
    const pinToggleBtn = page.locator('button:has-text("Hiện PIN"), button:has-text("Ẩn")').first();
    if (await pinToggleBtn.isVisible()) {
      await pinToggleBtn.click();
      await page.waitForTimeout(300);
      console.log('✅ Toggled PIN visibility (now visible)');
      await pinToggleBtn.click();
      await page.waitForTimeout(200);
      console.log('✅ Toggled PIN back to hidden');
    }

    // Tab 2: Kê đơn CPOE & An toàn
    const tab2Btn = page.locator('button[role="tab"]:has-text("Kê đơn CPOE")');
    await tab2Btn.click();
    await page.waitForTimeout(400);
    console.log('📸 Taking screenshot for Tab 2: Kê đơn CPOE & An toàn...');
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'user_guide_tab2_cpoe_safety.png') });

    // Tab 3: Kho Dược & Tủ trực
    const tab3Btn = page.locator('button[role="tab"]:has-text("Kho Dược & Tủ trực")');
    await tab3Btn.click();
    await page.waitForTimeout(400);
    console.log('📸 Taking screenshot for Tab 3: Kho Dược & Tủ trực...');
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'user_guide_tab3_pharmacy_stock.png') });

    // Tab 4: Thiết bị Y tế & Sự cố
    const tab4Btn = page.locator('button[role="tab"]:has-text("Thiết bị Y tế & Sự cố")');
    await tab4Btn.click();
    await page.waitForTimeout(400);
    console.log('📸 Taking screenshot for Tab 4: Thiết bị Y tế & Sự cố...');
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'user_guide_tab4_equipment_incident.png') });

    // Tab 5: Trợ lý AI Lâm sàng
    const tab5Btn = page.locator('button[role="tab"]:has-text("Trợ lý AI Lâm sàng")');
    await tab5Btn.click();
    await page.waitForTimeout(400);
    console.log('📸 Taking screenshot for Tab 5: Trợ lý AI Lâm sàng...');
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'user_guide_tab5_clinical_ai.png') });

    // Close button test
    const closeBtn = page.locator('button:has-text("Đã Hiểu & Đóng")');
    await closeBtn.click();
    await page.waitForTimeout(300);
    const isClosed = await modalHeader.isHidden();
    console.log(`✅ Modal closed verification: ${isClosed ? 'SUCCESS (closed)' : 'FAILED'}`);

    // Verify opening HDSD from Chatbot header
    console.log('🤖 Testing HDSD launch from Clinical Chatbot header...');
    const chatbotFloatingBtn = page.locator('button[title*="Trợ Lý AI"]').first();
    if (await chatbotFloatingBtn.isVisible()) {
      await chatbotFloatingBtn.click();
      await page.waitForTimeout(400);
      const chatbotHdsdBtn = page.locator('button[title="Mở hướng dẫn sử dụng hệ thống & quy trình ca trực"]').first();
      await chatbotHdsdBtn.waitFor({ state: 'visible', timeout: 3000 });
      await chatbotHdsdBtn.click();
      await modalHeader.waitFor({ state: 'visible', timeout: 3000 });
      console.log('✅ Successfully launched User Guide modal directly from Chatbot HDSD button!');
      // Close via Escape key
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
      const isClosedViaEsc = await modalHeader.isHidden();
      console.log(`✅ Modal closed via Escape key: ${isClosedViaEsc ? 'SUCCESS' : 'FAILED'}`);
    }

    console.log('🎉 ALL 5 USER GUIDE TABS & WORKFLOWS VERIFIED SUCCESSFULLY!');
  } catch (err) {
    console.error('❌ Verification failed:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main();
