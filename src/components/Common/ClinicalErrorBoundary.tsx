/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * ClinicalErrorBoundary: Bộ phòng vệ bắt lỗi React chống trắng trang (White Screen of Death)
 * Đảm bảo tính sẵn sàng 100% cho các phân hệ lâm sàng và giám định BHYT
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, ChevronDown, ChevronUp, ShieldAlert } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
}

export class ClinicalErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    showDetails: false
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('🛑 [ClinicalErrorBoundary] Bắt được lỗi giao diện chưa xử lý:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null, showDetails: false });
    if (this.props.onReset) {
      try {
        this.props.onReset();
      } catch (e) {
        console.warn('Lỗi khi gọi onReset:', e);
      }
    }
  };

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      const { fallbackTitle, fallbackMessage } = this.props;
      const { error, errorInfo, showDetails } = this.state;

      return (
        <div className="w-full h-full min-h-[350px] flex items-center justify-center p-4 bg-slate-50/50">
          <div className="max-w-xl w-full bg-white rounded-xl border border-rose-200 shadow-sm p-6 text-slate-800 space-y-4">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-lg bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-bold text-slate-900 leading-tight">
                  {fallbackTitle || 'Đã xảy ra sự cố hiển thị trong phân hệ này'}
                </h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  {fallbackMessage || 'Hệ thống đã tự động kích hoạt chế độ phòng vệ để ngăn chặn trắng trang. Bạn có thể khôi phục trạng thái ban đầu hoặc thử lại với tệp tài liệu khác.'}
                </p>
              </div>
            </div>

            {error && (
              <div className="bg-rose-50/70 border border-rose-100 rounded-lg p-3 text-xs text-rose-900 font-mono break-words">
                <strong>Thông điệp lỗi:</strong> {error.message || String(error)}
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-slate-100 flex-wrap gap-2.5">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={this.handleReset}
                  className="h-8 px-3.5 bg-teal-700 hover:bg-teal-800 text-white rounded-md text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer active:scale-98"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Khôi phục giao diện</span>
                </button>

                <button
                  type="button"
                  onClick={this.handleReload}
                  className="h-8 px-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-md text-xs font-semibold transition cursor-pointer"
                >
                  <span>Tải lại trang</span>
                </button>
              </div>

              {errorInfo && (
                <button
                  type="button"
                  onClick={() => this.setState(prev => ({ showDetails: !prev.showDetails }))}
                  className="text-2xs text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
                >
                  <span>{showDetails ? 'Ẩn chi tiết kỹ thuật' : 'Xem chi tiết kỹ thuật'}</span>
                  {showDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
              )}
            </div>

            {showDetails && errorInfo && (
              <div className="pt-2">
                <pre className="text-2xs bg-slate-900 text-slate-200 p-3 rounded-lg overflow-x-auto max-h-48 leading-relaxed font-mono">
                  {errorInfo.componentStack}
                </pre>
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
