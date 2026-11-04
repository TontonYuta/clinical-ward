import assert from 'node:assert';
import { isPrescriptionFormIntent } from '../src/utils/nlp/cpoeFormMatcher';

console.log('🧪 Testing isPrescriptionFormIntent...');

const positiveCases = [
  'mở form kê đơn',
  'mo form ke don',
  'mở đơn thuốc',
  'mo don thuoc',
  'kê đơn thuốc',
  'ke don thuoc',
  'mở form cpoe',
  'mở cpoe',
  'tạo đơn thuốc',
  'tạo đơn',
  'kê đơn',
  'ke don',
  'khi yêu cầu mở form kê đơn thì chatbot cần ẩn đi, form kê đơn hiện lên luôn',
  'mở biểu mẫu kê đơn',
  'vào form kê đơn',
  'mở giao diện kê đơn thuốc',
  'kê toa thuốc'
];

for (const text of positiveCases) {
  const result = isPrescriptionFormIntent(text);
  assert.strictEqual(result, true, `Failed positive case for: "${text}"`);
}
console.log(`✅ All ${positiveCases.length} positive cases matched successfully.`);

const negativeCases = [
  'Paracetamol tương tác với thuốc nào?',
  'kiểm tra tương tác thuốc Plavix và Nexium',
  'hướng dẫn dặn dò bệnh nhân uống thuốc',
  'nhắc lịch uống thuốc',
  'báo hỏng máy thở',
  'mượn 2 ống morphin',
  'kiểm tra kho fefo'
];

for (const text of negativeCases) {
  const result = isPrescriptionFormIntent(text);
  assert.strictEqual(result, false, `Failed negative case (should be false) for: "${text}"`);
}
console.log(`✅ All ${negativeCases.length} negative cases rejected successfully.`);
console.log('🎉 isPrescriptionFormIntent tests passed 100%!');
