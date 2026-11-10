/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Modal Phóng To & Soi Chi Tiết Ảnh Đơn Thuốc / Tài Liệu Y Tế (Image Lightbox Modal)
 * Hỗ trợ:
 * 1. Phóng to / Thu nhỏ (Zoom In / Zoom Out) mượt mà (50% - 300%)
 * 2. Xoay ảnh 90° để đọc đơn thuốc chụp ngang / dọc
 * 3. Tải ảnh gốc về máy (Download)
 * 4. Kéo rê di chuyển (Pan) khi ảnh được phóng to
 * 5. Đóng bằng phím Escape, nút đóng hoặc click ra ngoài vùng ảnh
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  ZoomIn, 
  ZoomOut, 
  RotateCw, 
  Download, 
  Maximize2, 
  RotateCcw,
  FileCheck
} from 'lucide-react';

interface ImageLightboxModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  title?: string;
  subtitle?: string;
}

export const ImageLightboxModal: React.FC<ImageLightboxModalProps> = ({
  isOpen,
  onClose,
  imageUrl,
  title = 'Kiểm tra ảnh đơn thuốc / tài liệu',
  subtitle
}) => {
  const [zoom, setZoom] = useState<number>(100);
  const [rotation, setRotation] = useState<number>(0);
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Reset trạng thái mỗi khi mở modal mới
  useEffect(() => {
    if (isOpen) {
      setZoom(100);
      setRotation(0);
      setPosition({ x: 0, y: 0 });
    }
  }, [isOpen, imageUrl]);

  // Phím tắt bàn phím (Escape để đóng, +/- để zoom, R để xoay)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === '+' || e.key === '=') {
        setZoom(prev => Math.min(300, prev + 25));
      } else if (e.key === '-' || e.key === '_') {
        setZoom(prev => Math.max(50, prev - 25));
      } else if (e.key === '0') {
        setZoom(100);
        setPosition({ x: 0, y: 0 });
      } else if (e.key.toLowerCase() === 'r') {
        setRotation(prev => (prev + 90) % 360);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !imageUrl) return null;

  const handleZoomIn = () => setZoom(prev => Math.min(300, prev + 25));
  const handleZoomOut = () => setZoom(prev => Math.max(50, prev - 25));
  const handleResetZoom = () => {
    setZoom(100);
    setPosition({ x: 0, y: 0 });
  };
  const handleRotate = () => setRotation(prev => (prev + 90) % 360);

  const handleDownload = () => {
    try {
      const link = document.createElement('a');
      link.href = imageUrl;
      link.download = title.replace(/\s+/g, '_') || 'anh_don_thuoc.png';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.warn('Lỗi tải ảnh:', err);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom <= 100) return;
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Khung xem ảnh chi tiết"
      className="fixed inset-0 z-60 flex flex-col bg-black/90 backdrop-blur-md animate-in fade-in duration-200 select-none"
      onClick={onClose}
    >
      {/* Top Header Controls */}
      <div 
        className="px-4 py-3 bg-slate-900/80 border-b border-white/10 flex items-center justify-between shrink-0 text-white z-10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 min-w-0 pr-4">
          <div className="p-1.5 bg-teal-500/20 border border-teal-500/40 rounded-lg text-teal-400 shrink-0">
            <FileCheck className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h4 className="text-sm font-bold text-white truncate">{title}</h4>
            <p className="text-2xs text-slate-400 truncate">
              {subtitle || 'Dùng chuột kéo để di chuyển khi phóng to • Bấm Esc để đóng'}
            </p>
          </div>
        </div>

        {/* Toolbar Buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="flex items-center bg-white/10 rounded-lg p-0.5 border border-white/15">
            <button
              type="button"
              onClick={handleZoomOut}
              disabled={zoom <= 50}
              className="p-1.5 hover:bg-white/20 rounded text-slate-200 disabled:opacity-30 disabled:hover:bg-transparent transition cursor-pointer"
              title="Thu nhỏ (-)"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-2xs font-bold px-2 text-slate-300 min-w-[42px] text-center">
              {zoom}%
            </span>
            <button
              type="button"
              onClick={handleZoomIn}
              disabled={zoom >= 300}
              className="p-1.5 hover:bg-white/20 rounded text-slate-200 disabled:opacity-30 disabled:hover:bg-transparent transition cursor-pointer"
              title="Phóng to (+)"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleResetZoom}
              className="p-1.5 hover:bg-white/20 rounded text-slate-200 transition cursor-pointer"
              title="Khôi phục kích thước 100% (Phím 0)"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            type="button"
            onClick={handleRotate}
            className="p-2 hover:bg-white/20 rounded-lg text-slate-200 border border-white/15 transition cursor-pointer"
            title="Xoay ảnh 90° (Phím R)"
          >
            <RotateCw className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleDownload}
            className="p-2 hover:bg-white/20 rounded-lg text-slate-200 border border-white/15 transition cursor-pointer"
            title="Tải ảnh về máy"
          >
            <Download className="w-4 h-4" />
          </button>

          <div className="w-px h-6 bg-white/20 mx-1" />

          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-rose-600 rounded-lg text-slate-200 hover:text-white border border-white/15 transition cursor-pointer"
            title="Đóng (Phím Esc)"
            aria-label="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Image Stage */}
      <div 
        className="flex-1 overflow-hidden flex items-center justify-center p-4 relative"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        style={{ cursor: zoom > 100 ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="transition-transform duration-100 ease-out inline-flex items-center justify-center"
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${zoom / 100}) rotate(${rotation}deg)`,
            transformOrigin: 'center center'
          }}
        >
          <img
            src={imageUrl}
            alt={title}
            draggable={false}
            className="max-h-[82vh] max-w-[90vw] object-contain rounded-md shadow-2xl bg-black/40 border border-white/10"
          />
        </div>
      </div>

      {/* Footer Hint */}
      <div 
        className="py-1.5 px-4 bg-slate-900/60 text-center text-3xs text-slate-400 border-t border-white/5 shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        Phóng to {zoom}% • Xoay {rotation}° • Click bên ngoài hoặc phím [Esc] để quay lại
      </div>
    </div>
  );
};
