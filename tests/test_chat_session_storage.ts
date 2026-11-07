/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Kiểm thử Đơn vị Quản lý Đa Phiên Hội Thoại (Multi-Session Storage & Logic)
 */

import assert from 'node:assert/strict';
import {
  createNewSession,
  generateSessionTitle,
  deleteChatSession,
  renameChatSession,
  loadChatSessions,
  saveChatSessions,
  getActiveSessionId,
  saveActiveSessionId
} from '../src/utils/storage/chatSessionStorage';
import { ChatSession } from '../src/types/chatSession';

// Mock localStorage
const storage = new Map<string, string>();
(globalThis as any).window = {};
(globalThis as any).localStorage = {
  getItem: (key: string) => storage.get(key) || null,
  setItem: (key: string, val: string) => storage.set(key, val),
  removeItem: (key: string) => storage.delete(key),
  clear: () => storage.clear()
};

console.log('======================================================================');
console.log('🧪 BẮT ĐẦU KIỂM THỬ ĐƠN VỊ HỆ THỐNG ĐA PHIÊN HỘI THOẠI (MULTI-SESSION)');
console.log('======================================================================\n');

// 1. Kiểm thử Tự động Đặt tên Thông minh (Auto-Generate Session Title)
console.log('--- 1. Kiểm thử Tự động Đặt tên Thông minh ---');
const t1 = generateSessionTitle('bệnh nhân Nguyễn Văn An cần 2 lọ morphin');
assert.ok(t1.includes('Nguyễn Văn An') && t1.includes('MORPHIN'), `Title phải chứa tên BN và thuốc: ${t1}`);
console.log(`✅ Title ca bệnh nhân: "${t1}"`);

const t2 = generateSessionTitle('thuốc nào cận hạn dưới 60 ngày');
assert.equal(t2, 'Kiểm tra FEFO & Hạn dùng');
console.log(`✅ Title FEFO: "${t2}"`);

const t3 = generateSessionTitle('máy thở PB840 phòng mổ bị hỏng');
assert.equal(t3, 'Báo cáo sự cố thiết bị');
console.log(`✅ Title Thiết bị: "${t3}"`);

const t4 = generateSessionTitle('kiểm tra tương tác morphin và diazepam');
assert.ok(t4.toLowerCase().includes('tương tác'));
console.log(`✅ Title Tương tác thuốc: "${t4}"`);

// 2. Kiểm thử Khởi tạo Phiên mới (Create New Session)
console.log('\n--- 2. Kiểm thử Khởi tạo Phiên mới ---');
const s1 = createNewSession();
assert.ok(s1.id.startsWith('sess_'), 'Session ID phải có tiền tố sess_');
assert.equal(s1.title, 'Cuộc trò chuyện mới');
assert.ok(s1.messages.length > 0, 'Phiên mới phải có tin nhắn chào mừng mặc định');
console.log(`✅ Tạo phiên thành công: ID = ${s1.id}`);

// 3. Kiểm thử Tính Độc lập Dữ liệu giữa các Phiên (Session Isolation)
console.log('\n--- 3. Kiểm thử Cách ly Ngữ cảnh giữa các Phiên ---');
const s2 = createNewSession('Ca cấp cứu Tim mạch');
s1.messages.push({
  id: 'msg-u1',
  sender: 'user',
  text: 'Bệnh nhân An cần 2 ống Fentanyl',
  timestamp: '10:00'
});
s2.messages.push({
  id: 'msg-u2',
  sender: 'user',
  text: 'Tra cứu liều Digoxin',
  timestamp: '10:05'
});

assert.notEqual(s1.id, s2.id);
assert.equal(s1.messages.filter(m => m.sender === 'user').length, 1);
assert.equal(s2.messages.filter(m => m.sender === 'user').length, 1);
assert.notEqual(s1.messages[s1.messages.length - 1].text, s2.messages[s2.messages.length - 1].text);
console.log('✅ Dữ liệu giữa 2 phiên hoàn toàn độc lập, không bị nhiễm chéo tin nhắn!');

// 4. Kiểm thử Lưu trữ và Khôi phục LocalStorage
console.log('\n--- 4. Kiểm thử Lưu trữ và Khôi phục LocalStorage ---');
saveChatSessions([s1, s2]);
const loaded = loadChatSessions();
assert.equal(loaded.length, 2);
assert.equal(loaded[0].id, s1.id);
assert.equal(loaded[1].id, s2.id);
console.log(`✅ Đã lưu và khôi phục thành công ${loaded.length} phiên từ LocalStorage`);

// 5. Kiểm thử Đổi tên Phiên (Rename Session)
console.log('\n--- 5. Kiểm thử Đổi tên Phiên ---');
const renamed = renameChatSession(s1.id, 'BN Nguyễn Văn An - Hồi sức', loaded);
assert.equal(renamed.find(s => s.id === s1.id)?.title, 'BN Nguyễn Văn An - Hồi sức');
console.log('✅ Đổi tên phiên thành công');

// 6. Kiểm thử Xóa Phiên & Chuyển Active ID
console.log('\n--- 6. Kiểm thử Xóa Phiên & Điều hướng ---');
const delResult = deleteChatSession(s1.id, renamed);
assert.equal(delResult.sessions.length, 1);
assert.equal(delResult.nextActiveId, s2.id);
console.log(`✅ Đã xóa phiên ${s1.id}, phiên kế tiếp được chọn là: ${delResult.nextActiveId}`);

// 7. Kiểm thử Xóa hết tất cả các phiên -> Tự động sinh phiên mới
console.log('\n--- 7. Kiểm thử Tự động sinh Phiên mới khi xóa hết ---');
const emptyDel = deleteChatSession(s2.id, delResult.sessions);
assert.equal(emptyDel.sessions.length, 1);
assert.ok(emptyDel.sessions[0].id.startsWith('sess_'));
console.log(`✅ Khi xóa hết phiên, hệ thống tự động sinh phiên trắng tinh mới: ${emptyDel.nextActiveId}`);

console.log('\n======================================================================');
console.log('🎉 TOÀN BỘ 7 NHÓM KIỂM THỬ ĐA PHIÊN HỘI THOẠI ĐÃ ĐẠT 100% GREEN!');
console.log('======================================================================');
