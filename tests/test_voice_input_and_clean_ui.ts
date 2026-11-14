import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

function runVoiceInputAndCleanUiTest() {
  console.log('🧪 BẮT ĐẦU KIỂM THỬ: Nhập Giọng Nói Tiếng Việt & Giao Diện Tối Giản Không Câu Mẫu');

  // 1. Kiểm tra ChatInputBar.tsx
  const chatInputBarPath = path.resolve('src/components/LeftPane/ChatInputBar.tsx');
  const chatInputBarCode = fs.readFileSync(chatInputBarPath, 'utf-8');
  const globalCss = fs.readFileSync(path.resolve('src/index.css'), 'utf-8');
  assert.ok(
    globalCss.includes('@keyframes chatbot-slow-glow') && globalCss.includes('.chatbot-launcher-glow'),
    'Nút mở chatbot cần hiệu ứng nhấp nháy nhẹ'
  );
  assert.ok(
    globalCss.includes('@media (prefers-reduced-motion: reduce)'),
    'Hiệu ứng phải tôn trọng thiết lập giảm chuyển động của hệ điều hành'
  );

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
  assert.ok(
    chatInputBarCode.includes('recognition.onspeechstart') && chatInputBarCode.includes('recognition.onspeechend'),
    'ChatInputBar phải xử lý onspeechstart và onspeechend để triệt tiêu độ trễ cảm nhận'
  );
  assert.ok(
    chatInputBarCode.includes('isUserSpeaking'),
    'ChatInputBar phải duy trì trạng thái người dùng đang nói'
  );
  assert.ok(
    !chatInputBarCode.includes('{liveInterimSnippet ? ('),
    'Transcript chỉ được hiển thị trong ô nhập, thanh trạng thái mic không được lặp lại transcript'
  );
  assert.ok(
    chatInputBarCode.includes('event.results[i]') && chatInputBarCode.includes('setInputText(merged)'),
    'Transcript interim/final phải cập nhật trực tiếp trong một ô nhập duy nhất'
  );
  assert.ok(
    chatInputBarCode.includes('scheduleVoiceDispatch') && chatInputBarCode.includes('VOICE_SILENCE_DELAY_MS = 1000'),
    'ChatInputBar dùng một lịch gửi tự động sau 1 giây im lặng'
  );
  assert.ok(
    chatInputBarCode.includes('aria-label="Sóng âm thanh"'),
    'ChatInputBar phải có hiệu ứng sóng âm thanh trực quan khi người dùng đang nói'
  );
  assert.ok(
    chatInputBarCode.includes('ref={inputFieldRef}'),
    'ChatInputBar phải gắn inputFieldRef vào ô nhập để tự động cuộn text theo thời gian thực'
  );
  assert.ok(
    chatInputBarCode.includes('VOICE_SILENCE_DELAY_MS = 1000'),
    'Thời gian tự gửi sau im lặng phải dùng một hằng số 1 giây'
  );
  assert.strictEqual(
    (chatInputBarCode.match(/window\.setTimeout\(/g) || []).length,
    2,
    'Chỉ được có timer tự gửi và timer xoá lỗi micro'
  );
  const onEndBlock = chatInputBarCode.slice(chatInputBarCode.indexOf('recognition.onend ='), chatInputBarCode.indexOf('recognitionRef.current = recognition;'));
  assert.ok(
    !onEndBlock.includes('dispatchVoiceMessage('),
    'onend không được gửi ngay, tránh bỏ qua khoảng im lặng thống nhất'
  );
  console.log('✅ ChatInputBar.tsx: Tích hợp One-click Voice Input tiếng Việt (vi-VN) chuẩn mực với Live Interim Preview, Audio Wave & Auto-scroll.');

  // 2. Kiểm tra ChatWindow.tsx: Render suggestedChips chuẩn xác và có bộ lọc
  const chatWindowPath = path.resolve('src/components/LeftPane/ChatWindow.tsx');
  const chatWindowCode = fs.readFileSync(chatWindowPath, 'utf-8');

  assert.ok(
    chatWindowCode.includes('msg.suggestedChips'),
    'ChatWindow phải hỗ trợ render suggestedChips khi có gợi ý chính xác'
  );
  assert.ok(
    chatWindowCode.includes('handleChipClick(chip)'),
    'ChatWindow phải gắn sự kiện click cho từng chip gợi ý'
  );
  console.log('✅ ChatWindow.tsx: Đã hỗ trợ render các câu hỏi gợi ý chuẩn xác (suggestedChips).');

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
