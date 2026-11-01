import { chromium } from 'playwright';

const PDF_DOCS = [
  {
    code: 'Thông tư 26/2025/TT-BYT',
    url: '/pdf/Thong_Tu_26_2025_TT_BYT_Ke_Don_Thuoc.pdf',
    minSize: 2000000,
  },
  {
    code: 'Dược Thư Quốc Gia Việt Nam',
    url: '/pdf/Duoc_Thu_Quoc_Gia_Viet_Nam.pdf',
    minSize: 30000000,
  },
  {
    code: 'Quyết định 5948/QĐ-BYT',
    url: '/pdf/Quyet_Dinh_5948_QD_BYT_Danh_Muc_Tuong_Tac_Chong_Chi_Dinh.pdf',
    minSize: 4000000,
  },
  {
    code: 'Thông tư 51/2017/TT-BYT',
    url: '/pdf/Thong_Tu_51_2017_TT_BYT_Huong_Dan_Phong_Chan_Doan_Xu_Tri_Phan_Ve.pdf',
    minSize: 2500000,
  },
  {
    code: 'Thông tư 20/2017/TT-BYT',
    url: '/pdf/Thong_Tu_20_2017_TT_BYT_Thuoc_Kiem_Soat_Dac_Biet.pdf',
    minSize: 8000000,
  },
  {
    code: 'Thông tư 22/2011/TT-BYT',
    url: '/pdf/Thong_Tu_22_2011_TT_BYT_Khoa_Duoc_Benh_Vien.pdf',
    minSize: 500000,
  },
];

async function main() {
  console.log('🔍 Checking all attached PDF files on dashboard...');
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  // 1. Visit overview dashboard
  await page.goto('http://localhost:3001/#overview', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  // 2. Check each document link on UI
  console.log('--- Checking UI Link Elements & URLs ---');
  for (const doc of PDF_DOCS) {
    const card = page.locator(`h4:has-text("${doc.code}")`).first();
    const isVisible = await card.isVisible();
    if (!isVisible) {
      throw new Error(`FAIL: Document card "${doc.code}" not visible on dashboard!`);
    }

    const link = page.locator(`a[href="${doc.url}"]`).first();
    const linkCount = await link.count();
    if (linkCount === 0) {
      throw new Error(`FAIL: PDF link for "${doc.url}" not found on dashboard!`);
    }

    // 3. Fetch PDF binary via browser context request
    const response = await page.request.get(`http://localhost:3001${doc.url}`);
    if (response.status() !== 200) {
      throw new Error(`FAIL: Fetching "${doc.url}" returned status ${response.status()}!`);
    }

    const contentType = response.headers()['content-type'];
    if (!contentType?.includes('application/pdf')) {
      throw new Error(`FAIL: Content-Type for "${doc.url}" is "${contentType}", expected application/pdf!`);
    }

    const body = await response.body();
    const header = body.subarray(0, 5).toString('utf-8');
    if (!header.startsWith('%PDF-')) {
      throw new Error(`FAIL: Invalid PDF magic header for "${doc.url}": "${header}"`);
    }

    console.log(`✅ [OK] ${doc.code}`);
    console.log(`     URL: ${doc.url}`);
    console.log(`     Status: ${response.status()} | Content-Type: ${contentType}`);
    console.log(`     Size: ${(body.length / 1024 / 1024).toFixed(2)} MB | Magic Header: ${header}`);
  }

  await browser.close();
  console.log('\n🎉 ALL 6 ATTACHED PDF FILES ARE 100% VALID & ACCESSIBLE!');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
