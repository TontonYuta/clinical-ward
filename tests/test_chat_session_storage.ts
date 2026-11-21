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
  saveActiveSessionId,
  normalizeUserStorageKey,
  getScopedSessionsKey,
  getScopedActiveIdKey,
  clearUserChatStorage,
  mergeSessions
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

// 8. Kiểm thử Chuẩn hóa Key & Phân tách Không gian Tài khoản
console.log('\n--- 8. Kiểm thử Chuẩn hóa Key theo User ---');
assert.equal(normalizeUserStorageKey(''), 'guest');
assert.equal(normalizeUserStorageKey(undefined), 'guest');
assert.equal(normalizeUserStorageKey('  BacSi_Lan.HoiSuc  '), 'bacsi_lan_hoisuc');
assert.equal(getScopedSessionsKey('bac_si_lan'), 'clinical_chat_sessions_bac_si_lan');
assert.equal(getScopedActiveIdKey('bac_si_lan'), 'clinical_active_chat_session_id_bac_si_lan');
console.log('✅ Chuẩn hóa key thành công!');

// 9. Kiểm thử Cách ly Tuyệt đối giữa các Tài khoản (Multi-User Isolation)
console.log('\n--- 9. Kiểm thử Cách ly Tuyệt đối giữa các Tài khoản ---');
storage.clear();

// Bác sĩ Lan đăng nhập và tạo phiên riêng
const sessLan = createNewSession('Ca cấp cứu của BS Lan');
sessLan.messages.push({
  id: 'lan-m1',
  sender: 'user',
  text: 'Bệnh nhân tim mạch cần theo dõi liều Adrenalin',
  timestamp: '11:00'
});
saveChatSessions([sessLan], 'bac_si_lan');
saveActiveSessionId(sessLan.id, 'bac_si_lan');

// Điều dưỡng Hùng đăng nhập trên cùng trình duyệt
const loadedHung = loadChatSessions('dieu_duong_hung');
// Hùng KHÔNG ĐƯỢC thấy session của Lan!
assert.notEqual(loadedHung[0].id, sessLan.id);
assert.equal(loadedHung[0].messages.some(m => m.text?.includes('Adrenalin')), false);
console.log('✅ Điều dưỡng Hùng đăng nhập: Hoàn toàn không nhìn thấy phiên của Bác sĩ Lan!');

// Điều dưỡng Hùng tạo phiên riêng của mình
const sessHung = createNewSession('Giao ban điều dưỡng ca trưa');
sessHung.messages.push({
  id: 'hung-m1',
  sender: 'user',
  text: 'Kiểm tra nợ vỏ morphin tủ trực cấp cứu',
  timestamp: '11:30'
});
saveChatSessions([sessHung], 'dieu_duong_hung');

// Bác sĩ Lan đăng nhập trở lại
const reloadedLan = loadChatSessions('bac_si_lan');
assert.equal(reloadedLan.length, 1);
assert.equal(reloadedLan[0].id, sessLan.id);
assert.equal(reloadedLan[0].title, 'Ca cấp cứu của BS Lan');
assert.ok(reloadedLan[0].messages.some(m => m.text?.includes('Adrenalin')));
// Lan không thấy phiên của Hùng
assert.equal(reloadedLan.some(s => s.title.includes('Giao ban')), false);
console.log('✅ Bác sĩ Lan quay lại: Lịch sử phiên hội thoại được bảo toàn 100%, độc lập tuyệt đối!');

// 10. Kiểm thử Tự động Di chuyển Dữ liệu Cũ (Legacy Migration)
console.log('\n--- 10. Kiểm thử Tự động Di chuyển Dữ liệu Cũ ---');
storage.clear();
const legacySession = createNewSession('Phiên cũ trước khi nâng cấp');
localStorage.setItem('clinical_chat_sessions_v1', JSON.stringify([legacySession]));

// User đăng nhập lần đầu sau nâng cấp
const migratedSessions = loadChatSessions('admin_portal');
assert.equal(migratedSessions.length, 1);
assert.equal(migratedSessions[0].title, 'Phiên cũ trước khi nâng cấp');
assert.equal(localStorage.getItem('clinical_chat_sessions_v1'), null, 'Khóa cũ phải được dọn dẹp sau di chuyển');
assert.ok(localStorage.getItem('clinical_chat_sessions_admin_portal') !== null, 'Dữ liệu đã chuyển sang key mới của admin');
console.log('✅ Migration tự động thành công và an toàn tuyệt đối!');

// 11. Kiểm thử Thuật toán Ghép hợp Đám mây & Đồng bộ Xuyên Thiết bị (SWR Cloud Merge)
console.log('\n--- 11. Kiểm thử Ghép hợp Đám mây & Đồng bộ Xuyên Thiết bị ---');
const localSess1: ChatSession = {
  id: 'sess_pc1',
  title: 'Hội thoại tại Buồng Cấp cứu',
  createdAt: 1000,
  updatedAt: 2000,
  messages: [
    { id: 'm1', sender: 'user', text: 'Bệnh nhân cần Paracetamol', timestamp: '10:00' },
    { id: 'm2', sender: 'agent', text: 'Liều 500mg IV', timestamp: '10:01' }
  ]
};

const cloudSess2: ChatSession = {
  id: 'sess_pc2_cloud',
  title: 'Hội thoại tại Phòng Giao ban',
  createdAt: 3000,
  updatedAt: 4000,
  messages: [
    { id: 'm3', sender: 'user', text: 'Báo cáo ca trực hôm qua', timestamp: '11:00' },
    { id: 'm4', sender: 'agent', text: 'Tổng hợp nợ 2 vỏ Morphin', timestamp: '11:01' }
  ]
};

// Trường hợp 1: Máy mới chưa có sess_pc2_cloud, nhận từ máy chủ
const merged1 = mergeSessions([localSess1], [cloudSess2]);
assert.equal(merged1.length, 2, 'Phải có đủ 2 phiên từ cả máy tính và máy chủ');
assert.equal(merged1[0].id, 'sess_pc2_cloud', 'Phiên mới hơn updatedAt phải được xếp lên đầu');
assert.equal(merged1[1].id, 'sess_pc1');
console.log('✅ Ghép hợp phiên xuyên máy tính thành công, không thiếu phiên nào!');

// Trường hợp 2: Cùng session id nhưng local đang chat dở có nhiều tin nhắn hơn cloud
const localSess1Updated: ChatSession = {
  ...localSess1,
  updatedAt: 5000,
  messages: [
    ...localSess1.messages,
    { id: 'm5', sender: 'user', text: 'Cho thêm liều 1g', timestamp: '10:05' }
  ]
};
const mergedConflict = mergeSessions([localSess1Updated], [localSess1]);
assert.equal(mergedConflict.find(s => s.id === 'sess_pc1')?.messages.length, 3, 'Phải bảo toàn bản có nhiều tin nhắn nhất');
console.log('✅ Chống xung đột dữ liệu: Bảo toàn tin nhắn mới nhất thành công!');

console.log('\n======================================================================');
console.log('🎉 TOÀN BỘ 11 NHÓM KIỂM THỬ ĐA PHIÊN & ĐỒNG BỘ ĐÁM MÂY ĐÃ ĐẠT 100% GREEN!');
console.log('======================================================================');
