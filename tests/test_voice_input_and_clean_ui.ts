import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

function runVoiceInputAndCleanUiTest() {
  console.log('🧪 BẮT ĐẦU KIỂM THỬ: Nhập Giọng Nói Tiếng Việt & Giao Diện Tối Giản Không Câu Mẫu');

  // 1. Kiểm tra ChatInputBar.tsx
  const chatInputBarPath = path.resolve('src/components/LeftPane/ChatInputBar.tsx');
  const chatInputBarCode = fs.readFileSync(chatInputBarPath, 'utf-8');

  assert.ok(
    chatInputBarCode.includes('SpeechRecognition'),
    'ChatInputBar phải tích hợp trực tiếp Web Speech API (SpeechRecognition)'
  );
  assert.ok(
    chatInputBarCode.includes("recognition.lang = 'vi-VN'"),
    'ChatInputBar phải nhận diện tiếng Việt (vi-VN)'
  );
  assert.ok(
    chatInputBarCode.includes('recognition.continuous = true'),
    'ChatInputBar phải cấu hình continuous = true để thu âm trọn vẹn'
  );
  assert.ok(
    chatInputBarCode.includes('recognition.interimResults = true'),
    'ChatInputBar phải bật interimResults = true để cập nhật văn bản thời gian thực'
  );
  assert.ok(
    chatInputBarCode.includes('data-testid="chat-voice-btn"'),
    'Nút mic phải có data-testid="chat-voice-btn" để kiểm thử tự động'
  );
  assert.ok(
    chatInputBarCode.includes('toggleListening'),
    'Nút mic phải kích hoạt toggleListening trực tiếp một chạm'
  );
  console.log('✅ ChatInputBar.tsx: Tích hợp One-click Voice Input tiếng Việt (vi-VN) chuẩn mực.');

  // 2. Kiểm tra ChatWindow.tsx: Không còn khối render suggestedChips
  const chatWindowPath = path.resolve('src/components/LeftPane/ChatWindow.tsx');
  const chatWindowCode = fs.readFileSync(chatWindowPath, 'utf-8');

  assert.ok(
    !chatWindowCode.includes('Gợi ý hỏi tiếp'),
    'ChatWindow không được chứa cụm "Gợi ý hỏi tiếp" (loại bỏ hoàn toàn các câu mẫu)'
  );
  assert.ok(
    !chatWindowCode.includes('msg.suggestedChips && msg.suggestedChips.length > 0'),
    'ChatWindow không được render các khối suggestedChips dưới tin nhắn'
  );
  console.log('✅ ChatWindow.tsx: Đã loại bỏ hoàn toàn các câu mẫu (Gợi ý hỏi tiếp).');

  // 3. Kiểm tra VoiceModal.tsx: Đã xóa toàn bộ câu mẫu và khẩu lệnh chuẩn hóa
  const voiceModalPath = path.resolve('src/components/Modals/VoiceModal.tsx');
  const voiceModalCode = fs.readFileSync(voiceModalPath, 'utf-8');

  assert.ok(
    !voiceModalCode.includes('PRESET_VOICE_CLIPS'),
    'VoiceModal không được chứa mảng PRESET_VOICE_CLIPS'
  );
  assert.ok(
    !voiceModalCode.includes('Mẫu khẩu lệnh lâm sàng chuẩn hóa'),
    'VoiceModal không được render danh sách mẫu khẩu lệnh lâm sàng'
  );
  assert.ok(
    voiceModalCode.includes("recognition.lang = 'vi-VN'"),
    'VoiceModal phải nhận diện tiếng Việt chuẩn xác'
  );
  assert.ok(
    voiceModalCode.includes('recognition.continuous = true'),
    'VoiceModal phải hỗ trợ continuous recognition'
  );
  console.log('✅ VoiceModal.tsx: Đã loại bỏ hoàn toàn các câu mẫu và nâng cấp Web Speech API.');

  console.log('🎉 TOÀN BỘ KIỂM THỬ NHẬP GIỌNG NÓI & GIAO DIỆN TỐI GIẢN ĐÃ ĐẠT 100% GREEN!');
}

runVoiceInputAndCleanUiTest();
