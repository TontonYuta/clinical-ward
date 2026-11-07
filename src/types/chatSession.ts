/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Định nghĩa Cấu trúc Dữ liệu Phiên Hội Thoại Đa Luồng (Multi-Session Chat) (<=50 LOC)
 */

import { ChatMessage } from './clinical';

export interface ChatSession {
  id: string;              // Mã định danh duy nhất (UUID), ví dụ: 'sess_1731002400_abc12'
  title: string;           // Tiêu đề phiên (tự sinh từ câu hỏi đầu hoặc do người dùng sửa)
  createdAt: number;       // Thời điểm khởi tạo (timestamp ms)
  updatedAt: number;       // Thời điểm cập nhật tin nhắn cuối cùng (timestamp ms)
  messages: ChatMessage[]; // Toàn bộ lịch sử tin nhắn trong phiên này
  clinicalTag?: string;    // Nhãn phân loại nghiệp vụ (CPOE, DDI, BHYT, Tủ trực...)
}
