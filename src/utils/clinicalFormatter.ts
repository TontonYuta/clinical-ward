/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Bộ chuẩn hóa và phân rã văn bản Dược Thư Lâm Sàng sang Thẻ cấu trúc (<=200 LOC)
 * Tối ưu hóa khả năng quét nhanh cho Bác sĩ & Dược sĩ lâm sàng
 */

export interface ClinicalBulletItem {
  label?: string;
  content: string;
  isImportant?: boolean;
}

export interface QuickDosageMetrics {
  routes: string[];
  standardDose?: string;
  interval?: string;
  maxDailyDose?: string;
  specialWarning?: string;
}

/**
 * Trích xuất chỉ số liều lượng cốt lõi để hiển thị trên Ribbon tóm tắt nhanh
 */
export function extractQuickDosageMetrics(text?: string): QuickDosageMetrics {
  if (!text) return { routes: [] };

  const routes: string[] = [];
  const t = text.toLowerCase();
  if (t.includes('uống') || t.includes('viên') || t.includes('nang')) routes.push('Đường uống');
  if (t.includes('truyền tĩnh mạch') || t.includes('tiêm tĩnh mạch') || t.includes('tiêm truyền')) routes.push('Truyền tĩnh mạch');
  if (t.includes('tiêm bắp')) routes.push('Tiêm bắp');
  if (t.includes('trực tràng') || t.includes('thuốc đạn')) routes.push('Đặt trực tràng');

  // Trích xuất liều tối đa / trần liều
  let maxDailyDose: string | undefined;
  const maxMatch = text.match(/(?:tối đa|trần liều|liều tối đa)[^\.\n;]*?(?:là\s*)?(\d+(?:[,\.]\d+)?\s*(?:g|mg|mcg|ml|lít|l)\/(?:ngày|24\s*giờ|24h))/i);
  if (maxMatch) {
    maxDailyDose = maxMatch[1].trim();
  }

  // Trích xuất khoảng cách liều
  let interval: string | undefined;
  const intMatch = text.match(/(\d+\s*-\s*\d+\s*giờ\s*(?:một lần|\/lần))/i) || text.match(/(cách\s*\d+\s*-\s*\d+\s*giờ)/i);
  if (intMatch) {
    interval = intMatch[1].trim();
  }

  // Trích xuất liều chuẩn 1 lần
  let standardDose: string | undefined;
  const stdMatch = text.match(/(?:liều(?:\s*uống)?(?:\s*thường dùng)?\s*(?:là)?\s*)(\d+(?:[,\.]\d+)?\s*(?:-\s*\d+(?:[,\.]\d+)?)?\s*(?:g|mg|mcg|ml)\/(?:lần)?)/i);
  if (stdMatch) {
    standardDose = stdMatch[1].trim();
  }

  // Cảnh báo liều trên bệnh nhân đặc biệt
  let specialWarning: string | undefined;
  if (t.includes('nghiện rượu') || t.includes('suy dinh dưỡng') || t.includes('mất nước')) {
    specialWarning = 'Tối đa 3 g/ngày ở bệnh nhân nghiện rượu, suy dinh dưỡng mạn hoặc mất nước.';
  }

  return {
    routes: routes.length > 0 ? routes : ['Đường dùng theo chỉ định'],
    standardDose,
    interval,
    maxDailyDose,
    specialWarning
  };
}

/**
 * Tách một chuỗi văn bản Dược thư thành mảng gạch đầu dòng có phân nhóm rõ ràng
 */
export function parseClinicalBullets(raw?: string): ClinicalBulletItem[] {
  if (!raw) return [];

  // Chuẩn hóa ngắt dòng và dấu gạch đầu
  const cleaned = raw.replace(/\r\n/g, '\n').trim();

  // Tách câu theo các tiêu mục lâm sàng thường gặp
  const pattern = /(?=(?:Đường uống|Liều uống|Đặt trực tràng|Truyền tĩnh mạch|Tiêm bắp|Tiêm tĩnh mạch|Trên 50 kg|Dưới 50 kg|Sơ sinh|Trẻ em|Đau, sốt|Đau:|Sốt:|Thời kỳ mang thai|Thời kỳ cho con bú|Phản ứng da|Nguy cơ suy gan|Thận trọng đặc biệt|Thuốc uống chống đông|Rửa dạ dày|Điều trị bằng):\s*)/gi;

  const rawChunks = cleaned.split(pattern).map((s) => s.trim()).filter(Boolean);
  const items: ClinicalBulletItem[] = [];

  for (const chunk of rawChunks) {
    // Tách label nếu có dạng "Tên mục: Nội dung"
    const colonIdx = chunk.indexOf(':');
    if (colonIdx > 0 && colonIdx <= 35 && !chunk.slice(0, colonIdx).includes('\n')) {
      const label = chunk.slice(0, colonIdx).trim();
      const content = chunk.slice(colonIdx + 1).trim();
      const isImportant = /suy gan|quá liều|tử vong|chống chỉ định|nghiêm trọng|phản vệ|sjs|ten/i.test(chunk);
      items.push({ label, content, isImportant });
    } else {
      // Tách tiếp theo dấu chấm câu nếu đoạn quá dài (> 200 ký tự)
      if (chunk.length > 200 && chunk.includes('. ')) {
        const sentences = chunk.split(/(?<=\.)\s+(?=[A-ZĐÁÀẢÃẠÂẤẦẨẪẬÊẾỀỂỄỆÔỐỒỔỖỘ])/g);
        for (const sent of sentences) {
          const s = sent.trim();
          if (s) {
            items.push({
              content: s,
              isImportant: /suy gan|quá liều|tử vong|chống chỉ định|nghiêm trọng/i.test(s)
            });
          }
        }
      } else {
        items.push({
          content: chunk,
          isImportant: /suy gan|quá liều|tử vong|chống chỉ định|nghiêm trọng/i.test(chunk)
        });
      }
    }
  }

  return items;
}

/**
 * Định dạng danh sách chống chỉ định thành các thẻ gạch đầu dòng súc tích
 */
export function formatContraindicationsList(text?: string): string[] {
  if (!text) return [];
  // Gộp các dòng bị gãy (OCR soft wrap) thành câu hoàn chỉnh
  const normalized = text.replace(/\r/g, '').replace(/\n+/g, ' ').trim();
  return normalized
    .split(/[\.;]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 3 && !/^(\.|\-|\*)$/.test(s));
}
