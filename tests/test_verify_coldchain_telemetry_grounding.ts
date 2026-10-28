import { chromium } from 'playwright';
import path from 'path';

const ARTIFACTS_DIR = '/home/tontonyuta/.gemini/antigravity-cli/brain/6e4038e2-8996-4f83-8957-99a20694c354';

async function main() {
  console.log('🚀 Bắt đầu kiểm thử Playwright UI: Grounded Cold Chain Telemetry vs Incident SOP...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });

  // 1. Mở Copilot Chat Drawer
  const copilotBtn = page.locator('button:has-text("Copilot"), button:has-text("Trợ lý"), button:has(svg.lucide-bot):visible').first();
  await copilotBtn.click();
  await page.waitForTimeout(600);

  const chatInput = page.locator('input[placeholder*="Nhập câu hỏi hoặc yêu cầu lâm sàng"]:visible').first();
  await chatInput.waitFor({ state: 'visible', timeout: 5000 });

  // --- TEST CASE 1: Telemetry Query "Nhiệt độ kho lạnh hiện tại" ---
  console.log('\n🌡️ Test 1: Gửi câu hỏi tra cứu thông số nhiệt độ kho lạnh hiện tại...');
  await chatInput.fill('Nhiệt độ kho lạnh hiện tại');
  await chatInput.press('Enter');
  await page.waitForTimeout(1500);

  let bodyText = await page.innerText('body');
  const hasTelemetryHeader = bodyText.includes('GIÁM SÁT CHUỖI LẠNH VẮC XIN');
  const hasNormalTemp = bodyText.includes('4.5°C') || bodyText.includes('4.5');
  const hasSafeStatus = bodyText.includes('Bình thường (An toàn)') || bodyText.includes('Đạt chuẩn GSP');
  const hasHallucinatedIncident = bodyText.includes('XỬ TRÍ SỰ CỐ NHIỆT ĐỘ CHUỖI LẠNH') || bodyText.includes('Kích hoạt bình tích lạnh dự phòng');

  console.log(`   ✅ hasTelemetryHeader: ${hasTelemetryHeader}`);
  console.log(`   ✅ hasNormalTemp: ${hasNormalTemp}`);
  console.log(`   ✅ hasSafeStatus: ${hasSafeStatus}`);
  console.log(`   🛡️ hasHallucinatedIncident (Phải FALSE): ${hasHallucinatedIncident}`);

  // Chụp ảnh bằng chứng Test 1
  const screenshotTelemetry = path.join(ARTIFACTS_DIR, 'verified_coldchain_telemetry_grounded.png');
  await page.screenshot({ path: screenshotTelemetry, fullPage: true });
  console.log(`📸 Đã chụp ảnh xác minh Telemetry: ${screenshotTelemetry}`);

  // --- TEST CASE 2: Emergency Query "Mất điện tủ lạnh vắc xin xử lý thế nào" ---
  console.log('\n🚨 Test 2: Gửi câu hỏi báo cáo sự cố mất điện / xử lý khẩn...');
  await chatInput.fill('Mất điện tủ lạnh vắc xin xử lý thế nào');
  await chatInput.press('Enter');
  await page.waitForTimeout(1500);

  bodyText = await page.innerText('body');
  const hasEmergencyHeader = bodyText.includes('XỬ TRÍ SỰ CỐ NHIỆT ĐỘ CHUỖI LẠNH');
  const hasIcePackAction = bodyText.includes('Kích hoạt bình tích lạnh');
  const hasQuarantineAction = bodyText.includes('Tạm thời cách ly lô vắc xin') || bodyText.includes('Quarantine');

  console.log(`   ✅ hasEmergencyHeader: ${hasEmergencyHeader}`);
  console.log(`   ✅ hasIcePackAction: ${hasIcePackAction}`);
  console.log(`   ✅ hasQuarantineAction: ${hasQuarantineAction}`);

  // Chụp ảnh bằng chứng Test 2
  const screenshotEmergency = path.join(ARTIFACTS_DIR, 'verified_coldchain_emergency_incident.png');
  await page.screenshot({ path: screenshotEmergency, fullPage: true });
  console.log(`📸 Đã chụp ảnh xác minh Emergency Incident: ${screenshotEmergency}`);

  await browser.close();

  if (hasTelemetryHeader && hasNormalTemp && hasSafeStatus && !hasHallucinatedIncident && hasEmergencyHeader && hasIcePackAction) {
    console.log('\n🎉 PLAYWRIGHT UI VERIFICATION THÀNH CÔNG RỰC RỠ: CHATBOT ĐÃ PHÂN ĐỊNH CHÍNH XÁC TELEMETRY VÀ SỰ CỐ KHẨN!');
    process.exit(0);
  } else {
    console.error('\n❌ VERIFICATION THẤT BẠI!');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Lỗi thực thi:', err);
  process.exit(1);
});
