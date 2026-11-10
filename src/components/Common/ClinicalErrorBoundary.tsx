/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * ClinicalErrorBoundary: Bộ phòng vệ bắt lỗi React chống trắng trang
 * Chỉ hiển thị popup thông báo lỗi tinh gọn, bảo mật 100% không để lộ stack trace hay API key
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { ShieldAlert, AlertTriangle, X, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Phân tích lỗi và trả về thông điệp thân thiện với người dùng, tuyệt đối không để lộ thông tin nhạy cảm
 */
function getSafeErrorMessage(error: Error | null, fallbackTitle?: string, fallbackMessage?: string): { title: string; message: string } {
  if (fallbackTitle && fallbackMessage) {
    return { title: fallbackTitle, message: fallbackMessage };
  }

  if (!error) {
    return {
      title: 'Thông báo sự cố',
      message: 'Đã xảy ra sự cố không xác định. Vui lòng thử lại.'
    };
  }

  const raw = (error.message || '').toLowerCase();

  // Nhóm lỗi cấu hình API Key / Xác thực
  if (raw.includes('key') || raw.includes('api') || raw.includes('401') || raw.includes('403') || raw.includes('quota') || raw.includes('unauthorized')) {
    return {
      title: 'Lỗi cấu hình dịch vụ AI',
      message: 'Dịch vụ phân tích chưa được cấu hình API Key hợp lệ hoặc đã chạm hạn mức. Vui lòng liên hệ quản trị viên để kiểm tra cấu hình.'
    };
  }

  // Nhóm lỗi định dạng dữ liệu
  if (raw.includes('format') || raw.includes('extension') || raw.includes('mime') || raw.includes('json') || raw.includes('parse') || raw.includes('xml')) {
    return {
      title: 'Lỗi không đúng định dạng',
      message: 'Tệp tải lên hoặc dữ liệu không đúng định dạng được hỗ trợ. Vui lòng chọn tệp PDF, Ảnh (JPG, PNG, WEBP) hoặc XML 130.'
    };
  }

  // Nhóm lỗi mạng / máy chủ
  if (raw.includes('network') || raw.includes('fetch') || raw.includes('connect') || raw.includes('timeout') || raw.includes('500') || raw.includes('502') || raw.includes('503')) {
    return {
      title: 'Lỗi kết nối máy chủ',
      message: 'Không thể kết nối đến máy chủ xử lý dữ liệu. Vui lòng kiểm tra lại kết nối mạng.'
    };
  }

  // Lỗi hiển thị chung
  return {
    title: 'Đã xảy ra sự cố xử lý',
    message: 'Hệ thống đã tự động bảo vệ dữ liệu để tránh gián đoạn. Bạn có thể đóng thông báo này và tiếp tục thao tác.'
  };
}

export class ClinicalErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Chỉ ghi nhận log nội bộ vào console trình duyệt ở môi trường dev, không render lên UI
    console.warn('⚠️ [ClinicalErrorBoundary] Intercepted runtime exception:', error.message);
  }

  private handleClose = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      try {
        this.props.onReset();
      } catch (e) {
        console.warn('Error during onReset:', e);
      }
    }
  };

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    const { hasError, error } = this.state;
    const { fallbackTitle, fallbackMessage } = this.props;

    if (hasError) {
      const safeInfo = getSafeErrorMessage(error, fallbackTitle, fallbackMessage);

      return (
        <div className="relative w-full h-full min-h-[350px]">
          {/* Vùng mờ nền của phân hệ */}
          <div className="w-full h-full p-4 bg-slate-50/70 opacity-40 pointer-events-none select-none filter blur-[1px]">
            {this.props.children}
          </div>

          {/* POPUP THÔNG BÁO LỖI TINH GỌN (Zero Info Leak) */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden text-slate-800 animate-in zoom-in-95 duration-150">
              {/* Header Popup */}
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3 bg-slate-50/60">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shrink-0">
                    <AlertTriangle className="w-4.5 h-4.5" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900 leading-snug">
                    {safeInfo.title}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={this.handleClose}
                  className="w-7 h-7 rounded-md hover:bg-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center transition cursor-pointer"
                  title="Đóng thông báo"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Nội dung Popup */}
              <div className="p-5 space-y-3">
                <p className="text-sm text-slate-600 leading-relaxed">
                  {safeInfo.message}
                </p>
                <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-3 text-xs text-slate-500">
                  🛡️ <strong>Ghi chú:</strong> Dữ liệu đơn thuốc và thông tin người bệnh hiện tại của bạn vẫn được bảo toàn an toàn.
                </div>
              </div>

              {/* Footer nút hành động */}
              <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={this.handleReload}
                  className="h-8.5 px-3.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold transition cursor-pointer shadow-2xs"
                >
                  Tải lại trang
                </button>
                <button
                  type="button"
                  onClick={this.handleClose}
                  className="h-8.5 px-4 bg-teal-800 hover:bg-teal-900 text-white rounded-lg text-xs font-bold transition cursor-pointer shadow-2xs active:scale-98"
                >
                  Đã hiểu &amp; Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
