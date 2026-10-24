/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  CreditCard,
  UserCheck,
  AlertTriangle,
  FileText,
  Lock,
  X,
  CheckCircle2,
  Users,
  Fingerprint,
  RefreshCw,
  Eye,
  EyeOff
} from 'lucide-react';
import { UserRole, UserProfile, ClinicalAuthRequest } from '../../types/clinical';
import { USER_PROFILES } from '../../data/initialData';
import { clinicalAudio } from '../../utils/audio';

interface ClinicalAuthModalProps {
  isOpen: boolean;
  request: ClinicalAuthRequest | null;
  currentUserRole: UserRole;
  onSwitchRole?: (role: UserRole) => void;
  onClose: () => void;
  isAudioMuted?: boolean;
}

export const ClinicalAuthModal: React.FC<ClinicalAuthModalProps> = ({
  isOpen,
  request,
  currentUserRole,
  onSwitchRole,
  onClose,
  isAudioMuted = false
}) => {
  const [selectedSignerRole, setSelectedSignerRole] = useState<UserRole>(currentUserRole);
  const [selectedWitnessRole, setSelectedWitnessRole] = useState<UserRole>('pharmacist');
  const [authMethod, setAuthMethod] = useState<'PIN' | 'RFID_NFC'>('PIN');
  const [pinInput, setPinInput] = useState<string>('');
  const [witnessPinInput, setWitnessPinInput] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [rfidSuccess, setRfidSuccess] = useState<boolean>(false);
  const [showDemoPin, setShowDemoPin] = useState<boolean>(false);

  // Sync state when opened or request changes
  useEffect(() => {
    if (isOpen && request) {
      // Always start with the active logged-in role to evaluate RBAC compliance
      setSelectedSignerRole(currentUserRole);

      // Default second witness
      if (request.requiresDualWitness) {
        const witnessRoles = request.dualWitnessRoles || (['pharmacist', 'doctor', 'nurse'] as UserRole[]);
        const defaultWitness = witnessRoles.find(r => r !== currentUserRole) || witnessRoles[0];
        setSelectedWitnessRole(defaultWitness);
      }

      setPinInput('');
      setWitnessPinInput('');
      setErrorMessage(null);
      setIsVerifying(false);
      setRfidSuccess(false);
    }
  }, [isOpen, request, currentUserRole]);

  if (!isOpen || !request) return null;

  const currentSigner = USER_PROFILES[selectedSignerRole] || USER_PROFILES[currentUserRole];
  const currentWitness = USER_PROFILES[selectedWitnessRole];
  const isSignerAuthorized = request.requiredRoles.includes(selectedSignerRole);

  // Quick PIN fill for demonstration ergonomics
  const handleQuickFillPin = () => {
    setPinInput(currentSigner.pinCode);
    if (request.requiresDualWitness && currentWitness) {
      setWitnessPinInput(currentWitness.pinCode);
    }
    setErrorMessage(null);
  };

  // RFID tap simulation handler
  const handleSimulateRfidTap = () => {
    if (!isSignerAuthorized) {
      setErrorMessage(`Vai trò ${currentSigner.roleName} không có thẩm quyền ký duyệt thao tác này theo quy định.`);
      if (!isAudioMuted) clinicalAudio.playAuthDeniedBeep();
      return;
    }

    if (!isAudioMuted) {
      clinicalAudio.playBadgeTapBeep();
    }
    setRfidSuccess(true);
    setIsVerifying(true);
    setErrorMessage(null);

    window.setTimeout(() => {
      setIsVerifying(false);
      if (!isAudioMuted) clinicalAudio.playSuccessChime();
      request.onConfirm(currentSigner, request.requiresDualWitness ? currentWitness : undefined, 'RFID_NFC');
      onClose();
    }, 700);
  };

  // Submit PIN verification handler
  const handleVerifyAndExecute = (e: React.FormEvent) => {
    e.preventDefault();

    if (!isSignerAuthorized) {
      setErrorMessage(`Vai trò ${currentSigner.roleName} không đủ thẩm quyền theo quy định.`);
      if (!isAudioMuted) clinicalAudio.playAuthDeniedBeep();
      return;
    }

    // Validate PIN
    if (pinInput.trim() !== currentSigner.pinCode) {
      setErrorMessage(`Mã PIN của ${currentSigner.name} không chính xác. Vui lòng kiểm tra lại.`);
      if (!isAudioMuted) clinicalAudio.playAuthDeniedBeep();
      return;
    }

    // Validate dual-witness PIN if required
    if (request.requiresDualWitness) {
      if (selectedWitnessRole === selectedSignerRole) {
        setErrorMessage('Người chứng kiến thứ hai phải là nhân sự y tế độc lập khác với người ký chính (TT 20/2017).');
        if (!isAudioMuted) clinicalAudio.playAuthDeniedBeep();
        return;
      }
      if (witnessPinInput.trim() !== currentWitness.pinCode) {
        setErrorMessage(`Mã PIN của người chứng kiến (${currentWitness.name}) không chính xác. Vui lòng kiểm tra lại.`);
        if (!isAudioMuted) clinicalAudio.playAuthDeniedBeep();
        return;
      }
    }

    setIsVerifying(true);
    setErrorMessage(null);

    window.setTimeout(() => {
      setIsVerifying(false);
      if (!isAudioMuted) clinicalAudio.playSuccessChime();
      request.onConfirm(currentSigner, request.requiresDualWitness ? currentWitness : undefined, 'PIN');
      onClose();
    }, 500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-lg shadow-xl border border-slate-200 max-w-xl w-full flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[92vh]">
        {/* Header */}
        <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-teal-600/30 border border-teal-400/40 flex items-center justify-center text-teal-300">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-tight text-white flex items-center gap-2">
                <span>Xác Thực Ký Duyệt Lâm Sàng</span>
                <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-teal-950/80 text-teal-300 border border-teal-500/30">
                  Nghị định 130/2018/NĐ-CP
                </span>
              </h2>
              <p className="text-[11px] text-slate-300">
                Xác nhận danh tính chuyên môn trước khi thực thi nghiệp vụ dược và thiết bị y tế
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-md hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs">
          {/* 1. Action Summary Box */}
          <div className="bg-slate-50 rounded-lg p-3.5 border border-slate-200 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                  Nghiệp vụ yêu cầu ký duyệt
                </span>
                <h3 className="text-sm font-bold text-slate-900 mt-0.5">
                  {request.title}
                </h3>
              </div>
              <span className="shrink-0 px-2 py-0.5 rounded font-mono text-[10px] font-bold bg-white text-slate-700 border border-slate-300 shadow-2xs">
                {request.actionType}
              </span>
            </div>

            <p className="text-slate-600 font-medium">
              {request.description}
            </p>

            <div className="pt-2 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-2 text-[11px]">
              <span className="text-slate-700">
                Đối tượng: <strong className="text-slate-950 font-bold">{request.targetItem}</strong>
              </span>
              <span className="font-mono text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200 font-semibold">
                Căn cứ: {request.legalBasis}
              </span>
            </div>
          </div>

          {/* 2. RBAC Authority Verification */}
          <div className={`p-3 rounded-lg border flex flex-col gap-2 ${
            isSignerAuthorized
              ? 'bg-emerald-50/50 border-emerald-200 text-emerald-950'
              : 'bg-amber-50/70 border-amber-300 text-amber-950'
          }`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {isSignerAuthorized ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                )}
                <span className="font-bold text-xs">
                  {isSignerAuthorized
                    ? 'Thẩm quyền hợp lệ: Người ký có quyền phê duyệt theo quy chế'
                    : 'Cảnh báo thẩm quyền: Vai trò hiện tại không đủ thẩm quyền theo quy định'}
                </span>
              </div>

              {/* Quick switch signer role selector */}
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[10px] text-slate-500 font-medium">Người ký:</span>
                <select
                  value={selectedSignerRole}
                  onChange={(e) => {
                    const newRole = e.target.value as UserRole;
                    setSelectedSignerRole(newRole);
                    setPinInput('');
                    setErrorMessage(null);
                    if (onSwitchRole) onSwitchRole(newRole);
                  }}
                  className="bg-white border border-slate-300 rounded px-2 py-0.5 text-xs font-bold text-slate-800 cursor-pointer shadow-2xs"
                >
                  {Object.values(USER_PROFILES).map((prof) => (
                    <option key={prof.role} value={prof.role}>
                      {prof.name} ({prof.roleName})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Signer credentials card */}
            <div className="bg-white/80 rounded p-2.5 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-xs">
                  {currentSigner.name.charAt(0)}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-slate-900">{currentSigner.name}</span>
                    <span className="text-[10px] font-semibold text-slate-500">· {currentSigner.roleName}</span>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-slate-500 font-mono mt-0.5 flex-wrap">
                    <span>CCHN: <strong className="text-slate-800">{currentSigner.practiceCertificate}</strong></span>
                    <span>Thẻ RFID: <strong className="text-slate-800">{currentSigner.rfidCardId}</strong></span>
                  </div>
                </div>
              </div>

              <span className="text-[10px] text-slate-400 font-mono">
                {currentSigner.department}
              </span>
            </div>
          </div>

          {/* 3. Dual-Witness Verification (Mandatory for TT 20 Narcotics destruction) */}
          {request.requiresDualWitness && (
            <div className="p-3 rounded-lg border border-purple-200 bg-purple-50/50 space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-purple-950">
                  <Users className="w-4 h-4 text-purple-700 shrink-0" />
                  <span className="font-bold text-xs">
                    Chứng thực kép (Dual-Witness Sign-off) - Bắt buộc theo TT 20/2017/TT-BYT
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[10px] text-purple-700 font-medium">Người chứng kiến:</span>
                  <select
                    value={selectedWitnessRole}
                    onChange={(e) => {
                      setSelectedWitnessRole(e.target.value as UserRole);
                      setWitnessPinInput('');
                      setErrorMessage(null);
                    }}
                    className="bg-white border border-purple-300 rounded px-2 py-0.5 text-xs font-bold text-slate-800 cursor-pointer shadow-2xs"
                  >
                    {Object.values(USER_PROFILES)
                      .filter(p => p.role !== selectedSignerRole)
                      .map((prof) => (
                        <option key={prof.role} value={prof.role}>
                          {prof.name} ({prof.roleName})
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <p className="text-[11px] text-purple-900 leading-relaxed">
                Điều 15 Thông tư 20/2017/TT-BYT bắt buộc 02 nhân viên y tế độc lập thuộc 2 khoa phòng cùng ký tên vào Biên bản tiêu hủy vỏ thuốc gây nghiện.
              </p>

              <div className="bg-white/80 rounded p-2.5 border border-purple-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="font-bold text-slate-900">{currentWitness.name}</span>
                  <span className="text-[10px] text-slate-500 ml-1.5">({currentWitness.roleName})</span>
                  <p className="text-[10px] font-mono text-slate-500">
                    CCHN: {currentWitness.practiceCertificate} · PIN xác thực: <strong className="text-purple-700">{showDemoPin ? currentWitness.pinCode : '••••'}</strong>
                  </p>
                </div>
                {authMethod === 'PIN' && (
                  <div className="w-full sm:w-28">
                    <input
                      type="password"
                      maxLength={4}
                      value={witnessPinInput}
                      onChange={(e) => setWitnessPinInput(e.target.value)}
                      placeholder="PIN Người 2"
                      className="w-full text-center tracking-widest font-mono text-xs font-bold py-1 px-2 border border-purple-300 rounded bg-white focus:outline-hidden focus:ring-1 focus:ring-purple-500"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 4. Authentication Method Selector */}
          <div className="space-y-3 pt-1">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2">
              <span className="font-bold text-slate-700 text-xs">
                Phương thức xác thực lâm sàng:
              </span>
              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setAuthMethod('PIN')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-semibold text-xs transition cursor-pointer ${
                    authMethod === 'PIN'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Mã PIN Y Tế</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAuthMethod('RFID_NFC')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-semibold text-xs transition cursor-pointer ${
                    authMethod === 'RFID_NFC'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>Chạm thẻ RFID / NFC</span>
                </button>
              </div>
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="p-2.5 rounded bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Method A: PIN Entry */}
            {authMethod === 'PIN' ? (
              <form onSubmit={handleVerifyAndExecute} className="space-y-3">
                <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 flex flex-col items-center gap-2">
                  <div className="flex items-center justify-between w-full">
                    <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                      <KeyRound className="w-3.5 h-3.5 text-teal-700" />
                      <span>Nhập mã PIN lâm sàng của {currentSigner.name}:</span>
                    </label>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handleQuickFillPin}
                        className="text-[11px] text-teal-700 hover:text-teal-900 font-semibold underline cursor-pointer"
                        title="Tự động điền mã PIN demo"
                      >
                        Điền nhanh PIN demo {showDemoPin ? `(${currentSigner.pinCode})` : '(••••)'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowDemoPin(prev => !prev)}
                        className="p-1 rounded hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition cursor-pointer"
                        title={showDemoPin ? "Ẩn mã PIN bảo mật" : "Hiện mã PIN demo"}
                        aria-label="Ẩn hiện mã PIN"
                      >
                        {showDemoPin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5 text-teal-700" />}
                      </button>
                    </div>
                  </div>

                  <div className="relative w-48 my-1">
                    <input
                      type="password"
                      maxLength={4}
                      autoFocus
                      value={pinInput}
                      onChange={(e) => {
                        setPinInput(e.target.value);
                        setErrorMessage(null);
                      }}
                      placeholder="••••"
                      className="w-full text-center tracking-[0.5em] font-mono text-xl font-black py-2 px-3 border border-slate-300 rounded-lg bg-white focus:outline-hidden focus:ring-2 focus:ring-teal-600 text-slate-900"
                    />
                  </div>

                  <p className="text-[10px] text-slate-400">
                    Mã PIN 4 số được cấp theo chứng chỉ hành nghề y tế {currentSigner.practiceCertificate}
                  </p>
                </div>

                {/* Footer Buttons for PIN */}
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-3.5 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 font-semibold text-xs transition cursor-pointer"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    disabled={isVerifying || !pinInput}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white font-bold text-xs transition shadow-2xs cursor-pointer active:scale-98"
                  >
                    {isVerifying ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Đang mã hóa chữ ký số...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Ký Xác Thực &amp; Thực Thi</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            ) : (
              /* Method B: RFID / NFC Badge tap simulation */
              <div className="space-y-3">
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 flex flex-col items-center justify-center text-center gap-3">
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${
                    rfidSuccess
                      ? 'bg-emerald-100 text-emerald-700 scale-105 ring-4 ring-emerald-200'
                      : 'bg-teal-50 text-teal-700 border border-teal-200'
                  }`}>
                    {rfidSuccess ? (
                      <CheckCircle2 className="w-8 h-8 animate-in zoom-in" />
                    ) : (
                      <CreditCard className="w-8 h-8 animate-pulse" />
                    )}
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-slate-800">
                      Mô phỏng máy đọc thẻ nhân viên y tế RFID/NFC
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Đưa thẻ định danh thông minh vào đầu đọc thẻ tại buồng bệnh hoặc tủ trực
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleSimulateRfidTap}
                    disabled={isVerifying}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-800 hover:bg-teal-900 text-white font-bold text-xs transition shadow-md cursor-pointer active:scale-95"
                  >
                    <Fingerprint className="w-4 h-4 text-emerald-300" />
                    <span>Chạm thẻ: {currentSigner.name} ({currentSigner.rfidCardId})</span>
                  </button>

                  <p className="text-[10px] font-mono text-slate-400">
                    Âm thanh bíp đầu đọc RFID bệnh viện được phát tự động khi chạm thẻ
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-3.5 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 font-semibold text-xs transition cursor-pointer"
                  >
                    Hủy bỏ
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Medical Legal Guarantee Notice */}
          <div className="border-t border-slate-200 pt-3 flex items-start gap-2 text-[10px] text-slate-500">
            <Lock className="w-3.5 h-3.5 text-teal-700 shrink-0 mt-0.5" />
            <span>
              Chữ ký điện tử y tế có giá trị pháp lý theo Nghị định 130/2018/NĐ-CP. Thao tác được tự động lưu trữ vào hồ sơ theo dõi lâm sàng của bệnh viện để bảo đảm an toàn người bệnh.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
