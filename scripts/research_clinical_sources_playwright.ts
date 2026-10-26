import { chromium } from 'playwright';
import * as path from 'path';

const ARTIFACT_DIR = '/home/tontonyuta/.gemini/antigravity-cli/brain/6e4038e2-8996-4f83-8957-99a20694c354';

async function main() {
  console.log('🔍 BẮT ĐẦU RESEARCH THỰC TẾ CÁC NGUỒN DỮ LIỆU LÂM SÀNG BẰNG PLAYWRIGHT...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 }
  });
  const page = await context.newPage();

  // 1. Kiểm tra Quyết định 5948/QĐ-BYT trên Cục Quản lý Khám chữa bệnh (kcb.vn)
  console.log('\n--- 1. CỤC QUẢN LÝ KHÁM CHỮA BỆNH (kcb.vn) ---');
  try {
    const res = await page.goto('https://kcb.vn/van-ban/quyet-dinh-so-5948-qd-byt-ve-viec-ban-hanh-tai-lieu-chuyen-mon-danh-muc-tuong-tac-thuoc-chong-chi-dinh-trong-thuc-hanh-lam-sang-tai-cac-co-so-kham-benh-chua-benh.html', { waitUntil: 'domcontentloaded', timeout: 15000 });
    console.log('Status kcb.vn:', res?.status());
    await page.waitForTimeout(2000);
    const title = await page.title();
    console.log('Tiêu đề trang kcb.vn:', title);
    const bodyText = await page.locator('article, .entry-content, main, body').first().innerText();
    console.log('Trích đoạn văn bản:', bodyText.slice(0, 300).replace(/\n+/g, ' '));
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'playwright_kcb_5948.png') });
    console.log('📸 Đã chụp: playwright_kcb_5948.png');
  } catch (err: any) {
    console.log('Lỗi truy cập kcb.vn:', err.message);
  }

  // 2. Kiểm tra Cổng Trung tâm DI & ADR Quốc gia (canhgiacduoc.org.vn)
  console.log('\n--- 2. TRUNG TÂM QUỐC GIA DI & ADR (canhgiacduoc.org.vn) ---');
  try {
    const res = await page.goto('http://canhgiacduoc.org.vn/', { waitUntil: 'domcontentloaded', timeout: 15000 });
    console.log('Status canhgiacduoc:', res?.status());
    await page.waitForTimeout(1500);
    const title = await page.title();
    console.log('Tiêu đề DI & ADR:', title);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'playwright_canhgiacduoc.png') });
    console.log('📸 Đã chụp: playwright_canhgiacduoc.png');
  } catch (err: any) {
    console.log('Lỗi truy cập canhgiacduoc:', err.message);
  }

  // 3. Kiểm tra Nguồn OpenFDA Drug Label API (DDI, Dosing, Contraindications)
  console.log('\n--- 3. OPENFDA CLINICAL LABEL API (NIH / FDA) ---');
  try {
    const res = await page.goto('https://api.fda.gov/drug/label.json?search=openfda.generic_name:ceftriaxone&limit=1', { waitUntil: 'networkidle', timeout: 15000 });
    console.log('Status OpenFDA:', res?.status());
    const rawJson = await page.locator('body').innerText();
    const data = JSON.parse(rawJson);
    const result = data.results?.[0];
    console.log('Brand name:', result?.openfda?.brand_name?.[0]);
    console.log('Có drug_interactions?:', Boolean(result?.drug_interactions));
    console.log('Có contraindications?:', Boolean(result?.contraindications));
    console.log('Có dosage_and_administration?:', Boolean(result?.dosage_and_administration));
    console.log('Trích đoạn tương tác thuốc FDA Ceftriaxone:', (result?.drug_interactions?.[0] || '').slice(0, 200).replace(/\n+/g, ' '));
  } catch (err: any) {
    console.log('Lỗi truy cập OpenFDA:', err.message);
  }

  // 4. Kiểm tra Cổng Thư Viện Pháp Luật về QĐ 5948/QĐ-BYT
  console.log('\n--- 4. THƯ VIỆN PHÁP LUẬT (QĐ 5948/QĐ-BYT) ---');
  try {
    await page.goto('https://thuvienphapluat.vn/van-ban/The-thao-Y-te/Quyet-dinh-5948-QD-BYT-2021-tai-lieu-chuyen-mon-Danh-muc-tuong-tac-thuoc-chong-chi-dinh-500355.aspx', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);
    const tvplTitle = await page.title();
    console.log('Tiêu đề TVPL:', tvplTitle);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'playwright_tvpl_5948.png') });
    console.log('📸 Đã chụp: playwright_tvpl_5948.png');
  } catch (err: any) {
    console.log('Lỗi truy cập TVPL:', err.message);
  }

  await browser.close();
  console.log('\n✅ HOÀN TẤT RESEARCH BẰNG PLAYWRIGHT!');
}

main().catch(console.error);
