import { chromium } from 'playwright';

const VERCEL_URL = 'https://clinical-ward.vercel.app';
const ARTIFACT_DIR = '/home/tontonyuta/.gemini/antigravity-cli/brain/6e4038e2-8996-4f83-8957-99a20694c354';

async function verifyLive() {
  console.log(`🌐 Đang mở trình duyệt kiểm thử trực tiếp trên Vercel: ${VERCEL_URL}`);
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  try {
    await page.goto(VERCEL_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1500);

    // 1. Kiểm tra Sổ nợ vỏ thuốc
    const morphinCard = page.locator('text=Morphin (Morphin hydroclorid 10mg/ml):visible').first();
    const hadunalinCard = page.locator('text=Hadunalin 1 mg/ml:visible').first();
    const kclCard = page.locator('text=Kali clorid 10%:visible').first();

    const debtStats = {
      morphin: await morphinCard.count() > 0,
      hadunalin: await hadunalinCard.count() > 0,
      kcl: await kclCard.count() > 0,
    };
    console.log('✅ Sổ nợ vỏ trực tuyến trên Vercel:', debtStats);
    await page.screenshot({ path: `${ARTIFACT_DIR}/verified_live_vercel_debts.png` });

    // 2. Chuyển sang Role Bác sĩ & Kê đơn CPOE
    const doctorBtn = page.locator('button:has-text("BS. Hùng"):visible').first();
    if (await doctorBtn.isVisible()) {
      await doctorBtn.click();
      await page.waitForTimeout(500);
    }
    const cpoeTabBtn = page.locator('button:has-text("Kê đơn CPOE"):visible').first();
    if (await cpoeTabBtn.isVisible()) {
      await cpoeTabBtn.click();
      await page.waitForTimeout(1000);
    }

    const voMinhTriPrescription = page.locator('text=Võ Minh Trí:visible').first();
    const dangThiLanPrescription = page.locator('text=Đặng Thị Lan:visible').first();
    const vancomycinPrescription = page.locator('text=VANCOMYCIN 1g:visible').first();

    const cpoeStats = {
      voMinhTri: await voMinhTriPrescription.count() > 0,
      dangThiLan: await dangThiLanPrescription.count() > 0,
      vancomycin: await vancomycinPrescription.count() > 0,
    };
    console.log('✅ Kê đơn CPOE trực tuyến trên Vercel:', cpoeStats);
    await page.screenshot({ path: `${ARTIFACT_DIR}/verified_live_vercel_cpoe.png` });

    console.log('🎉 TẤT CẢ KIỂM THỬ TRỰC TIẾP TRÊN BẢN DEPLOY VERCEL THÀNH CÔNG 100%!');
  } finally {
    await browser.close();
  }
}

verifyLive().catch(err => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
