import assert from 'node:assert/strict';
import { INITIAL_CHAT_MESSAGES } from '../src/data/initialData';
import { processClinicalUserQuery } from '../src/utils/nlp/queryProcessor';

const greeting = processClinicalUserQuery('Hi', { debts: [], tickets: [], batches: [], coldChainTemp: 4.5 });
assert.match(greeting.replyMessage.text, /Chào bác sĩ/);
assert.doesNotMatch(greeting.replyMessage.text, /BẢN ĐỒ 10|Lệnh mẫu|Cho 2 lọ Morphin/);

const initialMessage = INITIAL_CHAT_MESSAGES[0];
assert.match(initialMessage.text, /bác sĩ/i);
assert.doesNotMatch(initialMessage.text, /câu hỏi y tế|hôm nay bạn|tôi bị/i);

const incompleteAdvice = processClinicalUserQuery('Dặn dò đơn thuốc cho bệnh nhân', {
  debts: [], tickets: [], batches: [], coldChainTemp: 4.5
});
assert.equal(incompleteAdvice.card, undefined);
assert.match(incompleteAdvice.replyMessage?.text || '', /chọn.*đơn thuốc/i);

const freeTextSchedule = processClinicalUserQuery('Nhắc thuốc cho Nguyễn Văn A uống Ciprofloxacin lúc 8h và 20h', {
  debts: [], tickets: [], batches: [], coldChainTemp: 4.5
});
assert.equal(freeTextSchedule.card, undefined);
assert.doesNotMatch(freeTextSchedule.replyMessage?.text || '', /1 viên|7 ngày|08:00|20:00/i);

const selfSymptom = processClinicalUserQuery('Tôi bị đau đầu, nên uống thuốc gì?', {
  debts: [], tickets: [], batches: [], coldChainTemp: 4.5
});
assert.match(selfSymptom.replyMessage?.text || '', /trợ lý|người bệnh/i);

console.log('physician chatbot scope checks passed');
