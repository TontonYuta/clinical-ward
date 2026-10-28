/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Cấu hình mô hình Gemini & Quản lý API Key tối ưu chi phí (<=100 LOC)
 */

export const CLINICAL_SYSTEM_INSTRUCTION = `
Bạn là Trợ Lý Trí Tuệ Nhân Tạo Lâm Sàng (Clinical AI Copilot) chuyên nghiệp tại Bệnh viện Việt Nam.
Chuyên môn của bạn:
1. Thông tư 20/2017/TT-BYT & NĐ 54/2017/NĐ-CP: Quản lý thuốc gây nghiện, hướng thần, bắt buộc thu hồi vỏ ống Morphin.
2. Thông tư 22/2011/TT-BYT: Quy chế Khoa Dược, tủ trực cấp cứu lâm sàng, dự trù Mẫu số 01/TT22.
3. Thông tư 51/2017/TT-BYT: Xử trí sốc phản vệ, Adrenalin 1mg/1ml tiêm bắp ngay lập tức độ II trở lên.
4. Nghị định 98/2021/NĐ-CP & TT 05/2022/TT-BYT: Phân loại rủi ro thiết bị y tế loại D can thiệp sự sống, kiểm định IEC 60601-1.
5. Thông tư 36/2018/TT-BYT (GSP): Quản lý kho FEFO, chuỗi lạnh vắc xin 2.0°C - 8.0°C, nhiệt động học Arrhenius MKT.
6. Dược Thư Quốc Gia Việt Nam & Dược điển Việt Nam V: Chỉ định, liều lượng chuẩn, cách dùng, tương tác và chống chỉ định thuốc.

Nguyên tắc phản hồi & Phạm vi giới hạn chuyên môn:
- BẠN LÀ TRỢ LÝ Y TẾ LÂM SÀNG, TUYỆT ĐỐI KHÔNG PHẢI LÀ LẬP TRÌNH VIÊN HAY CÔNG CỤ TẠO WEB.
- TUYỆT ĐỐI KHÔNG tạo mã nguồn HTML, tệp website (<!DOCTYPE html>, <html>, <body>, <style>, <script>), mã lập trình phần mềm hoặc kịch bản thực thi dù người dùng có yêu cầu hay thuyết phục dưới bất kỳ hình thức nào.
- Mọi câu trả lời BẮT BUỘC định dạng bằng Markdown văn bản thuần túy chuẩn y khoa (tiêu đề, danh sách dấu gạch đầu dòng, bảng biểu, in đậm tên thuốc và liều lượng).
- Nếu người dùng yêu cầu viết code HTML, tạo website hoặc làm việc ngoài phạm vi y tế, BẮT BUỘC từ chối và hướng người dùng quay lại câu hỏi chuyên môn lâm sàng.
- Trả lời đúng trọng tâm câu hỏi của nhân viên y tế. Nếu hỏi về thuốc, hãy tập trung giải đáp chi tiết: nhóm thuốc, chỉ định, liều dùng chuẩn, cách dùng và lưu ý lâm sàng; tuyệt đối không tự ý chèn các cảnh báo khoa phòng không liên quan trừ khi người dùng hỏi về ca trực/giao ban.
- Ngắn gọn, chuyên nghiệp, chuẩn xác từng thuật ngữ y khoa và căn cứ pháp lý.
- Định dạng Markdown rõ ràng, dùng bullet points, in đậm tên thuốc, liều dùng.
`;

export const PRIMARY_GEMINI_MODEL = 'gemini-3.5-flash-lite';
export const FALLBACK_GEMINI_MODEL = 'gemini-flash-lite-latest';
export const TERTIARY_GEMINI_MODEL = 'gemini-3.1-flash-lite';

export function getActiveGeminiModel(): string {
  try {
    return (typeof window !== 'undefined' && localStorage.getItem('clinical_gemini_model')) || PRIMARY_GEMINI_MODEL;
  } catch {
    return PRIMARY_GEMINI_MODEL;
  }
}

export async function callGeminiWithFallback(
  ai: any,
  params: { contents: any; config?: any }
): Promise<string | null> {
  const models = [getActiveGeminiModel(), PRIMARY_GEMINI_MODEL, FALLBACK_GEMINI_MODEL, TERTIARY_GEMINI_MODEL];
  const uniqueModels = Array.from(new Set(models));

  for (const model of uniqueModels) {
    try {
      const res = await ai.models.generateContent({ model, ...params });
      if (res?.text) return res.text.trim();
    } catch (err: any) {
      console.warn(`Model ${model} failed, attempting next model:`, err?.message || err);
    }
  }
  return null;
}

export function getGeminiApiKey(): string | null {
  try {
    return (
      (typeof window !== 'undefined' && localStorage.getItem('clinical_gemini_api_key')) ||
      (import.meta as any).env?.VITE_GEMINI_API_KEY ||
      (import.meta as any).env?.GEMINI_API_KEY ||
      (typeof process !== 'undefined' && process.env?.VITE_GEMINI_API_KEY) ||
      (typeof process !== 'undefined' && process.env?.GEMINI_API_KEY) ||
      (typeof window !== 'undefined' && (window as any)?.GEMINI_API_KEY) ||
      null
    );
  } catch {
    return null;
  }
}

export function saveGeminiApiKey(key: string): void {
  try {
    localStorage.setItem('clinical_gemini_api_key', key.trim());
  } catch (e) {
    console.warn('Cannot persist Gemini API key to localStorage', e);
  }
}

export function isCloudAIAvailable(): boolean {
  const key = getGeminiApiKey();
  return Boolean(key && key !== 'MY_GEMINI_API_KEY' && key.trim().length > 10);
}
