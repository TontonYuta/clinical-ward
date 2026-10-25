/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Kiểm thử tích hợp Google Gemini 3.5 AI & Bảo mật API Key (<=200 LOC)
 */

import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import {
  isCloudAIAvailable,
  askGeminiClinicalCopilot,
  diagnoseBiomedicalDeviceWithGemini,
  getGeminiApiKey,
  PRIMARY_GEMINI_MODEL
} from '../src/services/geminiService';

// Nạp thủ công biến môi trường từ .env.local cho môi trường Node/TSX test runner
if (existsSync('.env.local')) {
  const envContent = readFileSync('.env.local', 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const [k, ...vParts] = trimmed.split('=');
      const val = vParts.join('=').replace(/^["']|["']$/g, '');
      process.env[k.trim()] = val;
    }
  }
}

async function runGeminiIntegrationTests() {
  console.log('======================================================================');
  console.log('🔒 KIỂM THỬ TÍCH HỢP GEMINI AI & XÁC THỰC BẢO MẬT API KEY GITHUB');
  console.log('======================================================================\n');

  // 1. Kiểm tra bảo mật Git (Bắt buộc .env.local phải nằm trong .gitignore)
  console.log('🔍 1. Kiểm tra tính bảo mật của tệp cấu hình chứa API Key (.env.local)...');
  const ignoreOutput = execSync('git check-ignore -v .env.local', { encoding: 'utf-8' }).trim();
  console.log(`   -> Git ignore match: "${ignoreOutput}"`);
  if (!ignoreOutput.includes('.gitignore')) {
    throw new Error('❌ NGUY HIỂM: .env.local KHÔNG được gitignore! Rò rỉ bí mật lên GitHub!');
  }
  console.log('   ✅ Tệp .env.local được gitignore bảo vệ 100%, tuyệt đối không thể push lên GitHub.\n');

  // 2. Kiểm tra Git Status: Không có khóa bí mật nào bị theo dõi (tracked)
  console.log('🔍 2. Kiểm tra trạng thái Git Index...');
  const trackedEnv = execSync('git ls-files .env.local', { encoding: 'utf-8' }).trim();
  if (trackedEnv) {
    throw new Error('❌ NGUY HIỂM: .env.local đang bị git theo dõi (tracked)!');
  }
  console.log('   ✅ Git index hoàn toàn sạch, không có vết khóa bí mật nào trong Git.\n');

  // 3. Kiểm tra hàm lấy API Key & Model cấu hình
  console.log('🔍 3. Kiểm tra nhận diện API Key trong hệ thống...');
  const apiKey = getGeminiApiKey();
  const available = isCloudAIAvailable();
  console.log(`   -> Đã tải API Key: ${apiKey ? `AQ...${apiKey.slice(-6)}` : 'KHÔNG TÌM THẤY'}`);
  console.log(`   -> Model mặc định: ${PRIMARY_GEMINI_MODEL}`);
  console.log(`   -> Trạng thái Cloud AI: ${available ? 'HOẠT ĐỘNG (ACTIVE)' : 'TẮT'}`);

  if (!available) {
    throw new Error('❌ Không thể tải API Key Gemini hoặc API Key không hợp lệ!');
  }
  console.log('   ✅ Hệ thống đã sẵn sàng kết nối Gemini Cloud AI.\n');

  // 4. Test Trợ lý Lâm sàng (Clinical Copilot)
  console.log('🩺 4. Gửi truy vấn lâm sàng: "Phác đồ Adrenalin theo Thông tư 51"...');
  const copilotAnswer = await askGeminiClinicalCopilot(
    'Cho tôi biết phác đồ cấp cứu Adrenalin khi phản vệ độ II trở lên theo Thông tư 51/2017/TT-BYT',
    { role: 'Điều dưỡng', activeDebtsCount: 2, coldChainTemp: 4.5 }
  );

  if (!copilotAnswer || copilotAnswer.length < 20) {
    throw new Error('❌ Không nhận được câu trả lời từ Gemini Clinical Copilot!');
  }
  console.log('   ✅ Gemini Clinical Copilot phản hồi thành công:');
  console.log(`   "${copilotAnswer.slice(0, 150)}..."\n`);

  // 5. Test Kỹ sư Thiết bị Y tế (Biomedical Diagnostic)
  console.log('🔧 5. Gửi truy vấn chẩn đoán TBYT: "Máy thở Puritan Bennett 840 xì khí"...');
  const bmeAnswer = await diagnoseBiomedicalDeviceWithGemini(
    'Máy thở Puritan Bennett 840',
    'Xì khí bẫy nước buồng thở',
    'ERR-VENT-840-01'
  );

  if (!bmeAnswer || bmeAnswer.length < 20) {
    throw new Error('❌ Không nhận được câu trả lời từ Gemini Biomedical Diagnostic!');
  }
  console.log('   ✅ Gemini Biomedical Diagnostic phản hồi thành công:');
  console.log(`   "${bmeAnswer.slice(0, 150)}..."\n`);

  console.log('======================================================================');
  console.log('🎉 TẤT CẢ KIỂM THỬ TÍCH HỢP GEMINI & BẢO MẬT API KEY ĐẠT 100%!');
  console.log('======================================================================\n');
}

runGeminiIntegrationTests().catch(err => {
  console.error('\n❌ LỖI KIỂM THỬ:', err);
  process.exit(1);
});
