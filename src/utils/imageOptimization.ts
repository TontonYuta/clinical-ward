/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Client-Side Canvas Image Compression & Preprocessing Pipeline
 * Lấy cảm hứng từ công cụ tham khảo "AI KIỂM TRA ĐƠN THUỐC" (toiUuAnhChoOCR):
 * - Tự động nén ảnh chụp điện thoại (5-10MB) xuống ~150-250KB với độ nét tối ưu cho OCR
 * - Giới hạn cạnh dài tối đa 1800px, bảo toàn tỷ lệ khung hình
 * - Đổ nền trắng #FFFFFF chống hiện tượng ảnh PNG trong suốt bị đen nền
 * - Xuất định dạng JPEG chuẩn chất lượng 0.78
 */

export interface ImageOptimizationResult {
  dataUrl: string;
  blob: Blob;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number; // Tỷ lệ nén (ví dụ 0.85 = giảm 85% dung lượng)
  width: number;
  height: number;
}

export interface ImageOptimizationOptions {
  maxSide?: number;
  quality?: number;
  enhanceContrast?: boolean;
}

/**
 * Tối ưu hóa và nén ảnh đơn thuốc phía Client bằng HTML5 Canvas:
 * - Tự động mở rộng độ phân giải lên 2048px bảo toàn chi tiết bảng và số lô/hạn dùng
 * - Tăng cường độ tương phản văn bản (Contrast Boosting) làm rõ nét chữ mờ, hóa đơn in kim
 * - Đổ nền trắng #FFFFFF chống đen nền ảnh PNG trong suốt
 * - Xuất định dạng JPEG chất lượng cao 0.85 loại bỏ hiện tượng vỡ hạt
 */
export async function compressImageForOcr(
  file: File | Blob,
  options: ImageOptimizationOptions = {}
): Promise<ImageOptimizationResult> {
  const { maxSide = 2048, quality = 0.85, enhanceContrast = true } = options;
  const originalSize = file.size;

  // Nếu là môi trường không có DOM (như SSR hoặc Node.js test), trả về fallback an toàn
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return {
      dataUrl: '',
      blob: file,
      originalSize,
      compressedSize: originalSize,
      compressionRatio: 0,
      width: 0,
      height: 0
    };
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => {
      reject(new Error('Không thể đọc tệp ảnh'));
    };

    reader.onload = (e) => {
      const img = new Image();

      img.onerror = () => {
        reject(new Error('Tệp tải lên không phải là định dạng hình ảnh hợp lệ'));
      };

      img.onload = () => {
        let w = img.width;
        let h = img.height;

        // Giới hạn cạnh lớn nhất theo maxSide (1800px)
        if (w > maxSide || h > maxSide) {
          if (w > h) {
            h = Math.round((h * maxSide) / w);
            w = maxSide;
          } else {
            w = Math.round((w * maxSide) / h);
            h = maxSide;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Không thể khởi tạo Canvas 2D context'));
          return;
        }

        // Đổ nền trắng toàn bộ để tránh ảnh trong suốt (PNG) bị nền đen khi chuyển sang JPEG
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, w, h);

        // Kỹ thuật nội suy hình ảnh sắc nét
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, w, h);

        // Tăng cường độ tương phản văn bản cho Vision OCR nhận diện chính xác
        if (enhanceContrast) {
          try {
            const imgData = ctx.getImageData(0, 0, w, h);
            const d = imgData.data;
            const factor = 1.15; // Tăng 15% tương phản làm rõ nét chữ mờ / in kim
            for (let i = 0; i < d.length; i += 4) {
              d[i] = Math.min(255, Math.max(0, ((d[i] - 128) * factor) + 128));
              d[i + 1] = Math.min(255, Math.max(0, ((d[i + 1] - 128) * factor) + 128));
              d[i + 2] = Math.min(255, Math.max(0, ((d[i + 2] - 128) * factor) + 128));
            }
            ctx.putImageData(imgData, 0, 0);
          } catch {
            // Bỏ qua nếu có hạn chế security canvas context
          }
        }

        const dataUrl = canvas.toDataURL('image/jpeg', quality);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Chuyển đổi Canvas sang Blob thất bại'));
              return;
            }

            const compressedSize = blob.size;
            const compressionRatio = originalSize > 0
              ? Math.max(0, (originalSize - compressedSize) / originalSize)
              : 0;

            resolve({
              dataUrl,
              blob,
              originalSize,
              compressedSize,
              compressionRatio,
              width: w,
              height: h
            });
          },
          'image/jpeg',
          quality
        );
      };

      img.src = e.target?.result as string;
    };

    reader.readAsDataURL(file);
  });
}
