/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Modal Đính Kèm Ảnh Đơn Thuốc / Vỏ Thuốc Cho Chatbot AI (Zero-Mock)
 * Chuyên trách: Thuốc - Kê đơn - Giám định BHYT
 * 1. Tải ảnh thực tế (kéo thả hoặc chọn tệp)
 * 2. Tự động nén Canvas Client-side (<250KB) bảo toàn độ nét tối ưu cho Vision OCR
 * 3. Khung xem trước (Live Thumbnail Preview) kèm kích thước và dung lượng tệp
 * 4. Nhập câu hỏi lâm sàng tùy biến (liều dùng, tương tác, điều kiện thanh toán BHYT)
 */

import React, { useState, useRef, useEffect } from 'react';
import { Camera, Upload, X, Check, Image as ImageIcon, Trash2, RefreshCw, AlertCircle, ZoomIn, Eye } from 'lucide-react';
import { compressImageForOcr } from '../../utils/imageOptimization';
import { ImageLightboxModal } from './ImageLightboxModal';

export interface SendImagePayload {
  title: string;
  prompt: string;
  imageBase64: string;
  imageMimeType: string;
  previewUrl: string;
  fileSizeKb: number;
}

interface ImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSendImage: (payload: SendImagePayload) => void;
  initialFile?: File | null;
  onInitialFileConsumed?: () => void;
}

export const ImageModal: React.FC<ImageModalProps> = ({
  isOpen,
  onClose,
  onSendImage,
  initialFile,
  onInitialFileConsumed
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<{
    file: File;
    previewUrl: string;
    base64Data: string;
    mimeType: string;
    sizeKb: number;
    originalSizeKb: number;
    width: number;
    height: number;
  } | null>(null);

  const [promptText, setPromptText] = useState<string>('');
  const [isProcessingFile, setIsProcessingFile] = useState<boolean>(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState<boolean>(false);


  useEffect(() => {
    if (!isOpen || !initialFile) return;
    onInitialFileConsumed?.();
    void handleProcessFile(initialFile);
  }, [isOpen, initialFile, onInitialFileConsumed]);

  if (!isOpen) return null;

  const handleProcessFile = async (file: File) => {
    setFileError(null);
    if (!file.type.startsWith('image/')) {
      setFileError('Vui lòng chọn tệp định dạng hình ảnh hợp lệ (.jpg, .png, .webp).');
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      setFileError('Dung lượng ảnh vượt quá 15MB. Vui lòng chọn ảnh nhỏ hơn.');
      return;
    }

    setIsProcessingFile(true);
    try {
      // Tự động nén Canvas phía Client để tối ưu token và thời gian phản hồi
      const opt = await compressImageForOcr(file, { maxSide: 1800, quality: 0.85 });
      setSelectedFile({
        file,
        previewUrl: opt.dataUrl,
        base64Data: opt.dataUrl,
        mimeType: 'image/jpeg',
        sizeKb: Math.round(opt.compressedSize / 1024),
        originalSizeKb: Math.round(opt.originalSize / 1024),
        width: opt.width,
        height: opt.height
      });

      // Nếu ô câu hỏi đang trống, tự động gán câu hỏi mặc định về thuốc / kê đơn / BHYT
      if (!promptText.trim()) {
        setPromptText(`Phân tích đơn thuốc / hình ảnh thuốc [${file.name}]: trích xuất danh mục hoạt chất, liều dùng, tương tác thuốc và rà soát điều kiện thanh toán BHYT.`);
      }
    } catch (err: any) {
      console.warn('Lỗi nén ảnh phía client:', err);
      // Fallback đọc trực tiếp DataURL
      const reader = new FileReader();
      reader.onload = (ev) => {
        const result = (ev.target?.result as string) || '';
        setSelectedFile({
          file,
          previewUrl: result,
          base64Data: result,
          mimeType: file.type || 'image/jpeg',
          sizeKb: Math.round(file.size / 1024),
          originalSizeKb: Math.round(file.size / 1024),
          width: 0,
          height: 0
        });
      };
      reader.readAsDataURL(file);
    } finally {
      setIsProcessingFile(false);
    }
  };


  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleProcessFile(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClearImage = () => {
    setSelectedFile(null);
    setFileError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleConfirmSend = () => {
    if (!selectedFile) return;

    const finalPrompt = promptText.trim() || 'Phân tích đơn thuốc / hình ảnh thuốc này: trích xuất danh mục hoạt chất, liều dùng, tương tác thuốc và rà soát điều kiện thanh toán BHYT.';
    onSendImage({
      title: selectedFile.file.name,
      prompt: finalPrompt,
      imageBase64: selectedFile.base64Data,
      imageMimeType: selectedFile.mimeType,
      previewUrl: selectedFile.previewUrl,
      fileSizeKb: selectedFile.sizeKb
    });

    handleClearImage();
    setPromptText('');
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="image-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2.5 sm:p-4 animate-in fade-in duration-200"
    >
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-xl w-full max-h-[92vh] flex flex-col overflow-hidden text-slate-800">
        {/* Header */}
        <div className="px-4 sm:px-5 py-3.5 bg-white border-b border-slate-200 flex items-center justify-between shrink-0 gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 bg-teal-50 border border-teal-200 rounded-lg shrink-0 text-teal-700">
              <Camera className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 id="image-modal-title" className="font-bold text-sm sm:text-base text-slate-900 truncate">
                Đính kèm ảnh Đơn thuốc / Vỏ thuốc / BHYT
              </h3>
              <p className="text-xs text-slate-500 truncate">
                Multimodal Vision AI: Trích xuất đơn thuốc, rà soát tương tác dược lý &amp; giám định BHYT
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition shrink-0 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />

          {/* Vùng chọn ảnh hoặc Preview ảnh */}
          {!selectedFile ? (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                const file = e.dataTransfer.files?.[0];
                if (file) handleProcessFile(file);
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition flex flex-col items-center justify-center gap-2.5 ${
                isDragging
                  ? 'border-teal-600 bg-teal-50/50 ring-2 ring-teal-500/20'
                  : 'border-slate-300 hover:border-teal-600 hover:bg-slate-50/80 bg-slate-50/30'
              }`}
            >
              <div className="w-12 h-12 rounded-full bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center shadow-2xs">
                {isProcessingFile ? (
                  <RefreshCw className="w-6 h-6 animate-spin text-teal-600" />
                ) : (
                  <Upload className="w-6 h-6" />
                )}
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800">
                  {isProcessingFile ? 'Đang tối ưu hóa hình ảnh...' : 'Nhấn để chọn ảnh hoặc kéo thả ảnh vào đây'}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Chụp rõ nét đơn thuốc, nhãn thuốc hoặc bảng kê chi phí BHYT (PNG, JPG, WEBP - tự động nén Canvas)
                </p>
              </div>
            </div>
          ) : (
            <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50/70 space-y-3">
              <div className="flex items-start gap-3.5">
                {/* Thumbnail Preview - Bấm vào để phóng to kiểm tra chi tiết */}
                <div
                  onClick={() => setIsLightboxOpen(true)}
                  className="w-24 h-24 sm:w-28 sm:h-28 rounded-lg overflow-hidden border border-slate-300 bg-black/5 shrink-0 flex items-center justify-center relative shadow-2xs cursor-zoom-in group transition hover:border-teal-500"
                  title="Nhấp vào ảnh để phóng to và kiểm tra chi tiết"
                >
                  <img
                    src={selectedFile.previewUrl}
                    alt="Preview"
                    className="w-full h-full object-contain group-hover:scale-105 transition duration-200"
                  />
                  <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition flex flex-col items-center justify-center gap-1 text-white p-1 text-center">
                    <ZoomIn className="w-5 h-5 drop-shadow" />
                    <span className="text-3xs font-bold leading-tight drop-shadow">Phóng to</span>
                  </div>
                </div>

                {/* File Metadata */}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200 inline-flex items-center gap-1">
                      <Check className="w-3 h-3" /> Đã nạp ảnh thành công
                    </span>
                    <button
                      type="button"
                      onClick={handleClearImage}
                      className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                      title="Gỡ ảnh này"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <h4 className="text-sm font-bold text-slate-900 truncate" title={selectedFile.file.name}>
                    {selectedFile.file.name}
                  </h4>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs text-slate-500">
                    <span>Dung lượng nén: <strong>{selectedFile.sizeKb} KB</strong></span>
                    {selectedFile.originalSizeKb > selectedFile.sizeKb && (
                      <span className="text-emerald-700">
                        (Giảm {Math.round(((selectedFile.originalSizeKb - selectedFile.sizeKb) / selectedFile.originalSizeKb) * 100)}%)
                      </span>
                    )}
                    {selectedFile.width > 0 && (
                      <span>Độ phân giải: {selectedFile.width} × {selectedFile.height}px</span>
                    )}
                  </div>

                  <div className="pt-1.5 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setIsLightboxOpen(true)}
                      className="text-xs font-semibold text-teal-800 hover:text-teal-900 hover:underline inline-flex items-center gap-1 cursor-pointer"
                    >
                      <ZoomIn className="w-3.5 h-3.5" /> Phóng to kiểm tra
                    </button>
                    <span className="text-slate-300">•</span>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-xs font-semibold text-slate-600 hover:text-slate-800 hover:underline inline-flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" /> Đổi ảnh khác
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {fileError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2 text-xs text-rose-700">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{fileError}</span>
            </div>
          )}

          {/* Ô nhập câu hỏi / yêu cầu lâm sàng */}
          <div className="space-y-1.5">
            <label htmlFor="clinical-image-prompt" className="text-xs font-bold text-slate-700 flex items-center justify-between">
              <span>Nội dung yêu cầu / Câu hỏi lâm sàng cho AI:</span>
              <span className="text-2xs font-normal text-slate-400">Tùy biến câu hỏi</span>
            </label>
            <textarea
              id="clinical-image-prompt"
              rows={3}
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              placeholder="Ví dụ: Phân tích đơn thuốc này, kiểm tra tương tác thuốc, liều dùng hoặc giám định điều kiện thanh toán BHYT theo TT 20/2022/TT-BYT..."
              className="w-full text-xs sm:text-sm p-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-700 focus:border-transparent resize-none leading-relaxed"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-between items-center shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition cursor-pointer"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleConfirmSend}
            disabled={!selectedFile || isProcessingFile}
            className="flex items-center gap-1.5 px-4.5 py-2 rounded-lg bg-teal-800 hover:bg-teal-900 text-white text-xs font-bold transition shadow-2xs active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>Đính kèm &amp; Gửi cho AI</span>
          </button>
        </div>
      </div>

      {/* Lightbox Modal phóng to kiểm tra ảnh đơn thuốc */}
      {selectedFile && (
        <ImageLightboxModal
          isOpen={isLightboxOpen}
          onClose={() => setIsLightboxOpen(false)}
          imageUrl={selectedFile.previewUrl}
          title={selectedFile.file.name}
          subtitle={`Dung lượng: ${selectedFile.sizeKb} KB • Độ phân giải: ${selectedFile.width}×${selectedFile.height}px • Kiểm tra chi tiết đơn thuốc`}
        />
      )}
    </div>
  );
};
