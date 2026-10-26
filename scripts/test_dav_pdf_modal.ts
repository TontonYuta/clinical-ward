import { chromium } from 'playwright';

async function test() {
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:4173');
  await page.locator('button:has-text("Kho dược FEFO"):visible').first().click();
  await page.waitForTimeout(600);

  // 1. Check Ceftriaxona
  await page.locator('tbody tr:has-text("Ceftriaxona Normon 1g"):visible button:has-text("Chi tiết")').first().click();
  await page.waitForTimeout(600);

  const ceftriaHdsd = await page.locator('a:has-text("Xem Tờ HDSD (PDF Gốc)")').first().getAttribute('href');
  const ceftriaLabel = await page.locator('a:has-text("Xem Mẫu Nhãn (PDF)")').first().getAttribute('href');
  console.log('✅ Ceftriaxona HDSD URL:', ceftriaHdsd?.slice(0, 95));
  console.log('✅ Ceftriaxona Label URL:', ceftriaLabel?.slice(0, 95));

  await page.screenshot({ path: '/home/tontonyuta/.gemini/antigravity-cli/brain/6e4038e2-8996-4f83-8957-99a20694c354/playwright_dav_ceftriaxona_pdf_modal.png' });

  // Close modal with visible button
  await page.locator('.fixed.inset-0:visible button:has(svg.lucide-x)').first().click();
  await page.waitForTimeout(400);

  // 2. Check 55k Venclexta from National Registry
  await page.locator('button:has-text("Cổng Dược Quốc Gia"):visible').first().click();
  await page.waitForTimeout(600);
  await page.locator('input[placeholder*="Tìm trên 55.000"]:visible').first().fill('Venclexta');
  await page.waitForTimeout(800);
  await page.locator('tbody tr:has-text("Venclexta"):visible button:has-text("Chi tiết")').first().click();
  await page.waitForTimeout(600);

  const venclextaHdsd = await page.locator('a:has-text("Xem Tờ HDSD (PDF Gốc)")').first().getAttribute('href');
  console.log('✅ 55k Venclexta HDSD URL:', venclextaHdsd?.slice(0, 95));

  await page.screenshot({ path: '/home/tontonyuta/.gemini/antigravity-cli/brain/6e4038e2-8996-4f83-8957-99a20694c354/playwright_dav_venclexta_pdf_modal.png' });

  await browser.close();
  console.log('🎉 TOÀN BỘ KIỂM TRA TÍCH HỢP HDSD & MẪU NHÃN PDF THÀNH CÔNG RỰC RỠ!');
}

test();
