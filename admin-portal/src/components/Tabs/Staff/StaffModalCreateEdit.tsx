import React, { useState, useEffect } from 'react';
import { X, UserPlus, Save, RefreshCw, Key, ShieldAlert, Lock, Eye, EyeOff, Sparkles, ShieldCheck } from 'lucide-react';
import { StaffItem, StaffCreatePayload, StaffUpdatePayload } from '../../../types/staff';

interface StaffModalCreateEditProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: StaffCreatePayload | StaffUpdatePayload, isEditing: boolean) => Promise<void>;
  editingStaff: StaffItem | null;
}

const ROLES = [
  { value: 'doctor', label: 'Bác Sĩ Điều Trị', defaultTitle: 'Bác Sĩ Điều Trị' },
  { value: 'nurse', label: 'Điều Dưỡng Ca Trực', defaultTitle: 'Điều Dưỡng Ca Trực' },
  { value: 'pharmacist', label: 'Dược Sĩ Lâm Sàng', defaultTitle: 'Dược Sĩ Kho Dược' },
  { value: 'biomedical_engineer', label: 'Kỹ Sư Trang Thiết Bị', defaultTitle: 'Kỹ Sư Trang Thiết Bị Y Tế' },
  { value: 'director', label: 'Ban Giám Đốc Bệnh Viện', defaultTitle: 'Ban Giám Đốc Bệnh Viện' },
];

const DEPARTMENTS = [
  'Khoa Cấp Cứu A9',
  'Khoa Hồi Sức Tích Cực (ICU)',
  'Khoa Ngoại Chấn Thương',
  'Kho Dược Lâm Sàng',
  'Phòng Vật Tư - TBYT',
  'Khoa Can Thiệp Tim Mạch',
  'Khoa Khám Bệnh',
  'Ban Giám Đốc',
];

const ACADEMIC_TITLES = ['BS', 'BSCKI', 'BSCKII', 'ThS.BS', 'TS.BS', 'PGS.TS.BS', 'GS.TS', 'ĐD', 'ThS.ĐD', 'DS', 'DSCKI', 'KS'];

export const StaffModalCreateEdit: React.FC<StaffModalCreateEditProps> = ({
  isOpen,
  onClose,
  onSubmit,
  editingStaff,
}) => {
  const isEditing = Boolean(editingStaff);

  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('doctor');
  const [roleName, setRoleName] = useState('Bác Sĩ Điều Trị');
  const [department, setDepartment] = useState('Khoa Cấp Cứu A9');
  const [practiceCertificate, setPracticeCertificate] = useState('');
  const [pinCode, setPinCode] = useState('1234');
  const [rfidCardId, setRfidCardId] = useState('');
  const [responsibilities, setResponsibilities] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [dob, setDob] = useState('');
  const [academicTitle, setAcademicTitle] = useState('BS');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isActive, setIsActive] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (editingStaff) {
      setId(editingStaff.id);
      setName(editingStaff.name);
      setRole(editingStaff.role);
      setRoleName(editingStaff.role_name);
      setDepartment(editingStaff.department);
      setPracticeCertificate(editingStaff.practice_certificate);
      setPinCode(editingStaff.pin_code);
      setRfidCardId(editingStaff.rfid_card_id);
      setResponsibilities(editingStaff.responsibilities || '');
      setEmail(editingStaff.email || '');
      setPhone(editingStaff.phone || '');
      setDob(editingStaff.dob || '');
      setAcademicTitle(editingStaff.academic_title || 'BS');
      setUsername(editingStaff.username || '');
      setPassword('');
      setMustChangePassword(editingStaff.must_change_password || false);
      setIsActive(editingStaff.is_active);
    } else {
      const randomHex = Math.floor(1000 + Math.random() * 9000);
      setId(`u-${randomHex}`);
      setName('');
      setRole('doctor');
      setRoleName('Bác Sĩ Điều Trị');
      setDepartment('Khoa Cấp Cứu A9');
      setPracticeCertificate('');
      setPinCode(String(Math.floor(1000 + Math.random() * 9000)));
      setRfidCardId(`RFID-DOC-${randomHex}`);
      setResponsibilities('Kê đơn CPOE, hội chẩn lâm sàng, thực hiện ca trực buồng bệnh');
      setEmail('');
      setPhone('');
      setDob('');
      setAcademicTitle('BS');
      setUsername('');
      setPassword('Med@2026!');
      setMustChangePassword(true);
      setIsActive(true);
    }
    setErrorMessage(null);
  }, [editingStaff, isOpen]);

  const handleSuggestUsername = () => {
    const rolePrefix: Record<string, string> = {
      doctor: 'bs',
      nurse: 'dd',
      pharmacist: 'ds',
      biomedical_engineer: 'ks',
      director: 'gd',
    };
    const prefix = rolePrefix[role] || 'nv';
    const clean = name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .trim()
      .toLowerCase();
    const parts = clean.split(/\s+/).filter(
      (p) => !['bs', 'bsck', 'bscki', 'bsckii', 'ths', 'ts', 'pgs', 'gs', 'dd', 'ds', 'ks', 'cn'].includes(p)
    );
    if (parts.length > 0) {
      setUsername(`${prefix}_${parts[parts.length - 1]}`);
    } else {
      setUsername(`${prefix}_${Math.floor(100 + Math.random() * 900)}`);
    }
  };

  const handleGeneratePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
    let pwd = 'Med@';
    for (let i = 0; i < 8; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(pwd);
  };

  const handleRoleChange = (newRole: string) => {
    setRole(newRole);
    const matched = ROLES.find((r) => r.value === newRole);
    if (matched) {
      setRoleName(matched.defaultTitle);
    }
    if (!isEditing) {
      const code = Math.floor(1000 + Math.random() * 9000);
      setRfidCardId(`RFID-${newRole.slice(0, 4).toUpperCase()}-${code}`);
    }
  };

  const handleGeneratePin = () => {
    const randomPin = String(Math.floor(1000 + Math.random() * 9000));
    setPinCode(randomPin);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!name.trim()) {
      setErrorMessage('Vui lòng nhập họ và tên nhân viên.');
      return;
    }
    if (!practiceCertificate.trim()) {
      setErrorMessage('Vui lòng nhập số Chứng chỉ hành nghề (CCHN) hoặc mã định danh vị trí.');
      return;
    }
    if (!/^\d{4,6}$/.test(pinCode.trim())) {
      setErrorMessage('Mã PIN xác thực ca trực phải gồm từ 4 đến 6 chữ số (VD: 1234).');
      return;
    }
    if (phone.trim() && !/^[0-9+]{9,12}$/.test(phone.trim())) {
      setErrorMessage('Số điện thoại không hợp lệ (gồm 9 - 11 chữ số).');
      return;
    }
    if (username.trim() && !/^[a-z0-9_.-]{3,50}$/i.test(username.trim())) {
      setErrorMessage('Tên đăng nhập không hợp lệ. Chỉ chấp nhận chữ cái không dấu, số, dấu gạch dưới (từ 3-50 ký tự).');
      return;
    }
    if (password.trim() && password.trim().length < 6) {
      setErrorMessage('Mật khẩu phải có độ dài tối thiểu 6 ký tự.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (isEditing) {
        await onSubmit(
          {
            name: name.trim(),
            role,
            role_name: roleName.trim(),
            department,
            practice_certificate: practiceCertificate.trim(),
            pin_code: pinCode.trim(),
            rfid_card_id: rfidCardId.trim(),
            responsibilities: responsibilities.trim(),
            email: email.trim() || undefined,
            phone: phone.trim() || undefined,
            dob: dob.trim() || undefined,
            academic_title: academicTitle || undefined,
            username: username.trim() || undefined,
            password: password.trim() || undefined,
            must_change_password: mustChangePassword,
            is_active: isActive,
          },
          true
        );
      } else {
        await onSubmit(
          {
            id: id.trim() || undefined,
            name: name.trim(),
            role,
            role_name: roleName.trim(),
            department,
            practice_certificate: practiceCertificate.trim(),
            pin_code: pinCode.trim(),
            rfid_card_id: rfidCardId.trim(),
            responsibilities: responsibilities.trim(),
            email: email.trim() || undefined,
            phone: phone.trim() || undefined,
            dob: dob.trim() || undefined,
            academic_title: academicTitle || undefined,
            username: username.trim() || undefined,
            password: password.trim() || undefined,
            must_change_password: mustChangePassword,
            is_active: isActive,
          },
          false
        );
      }
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Lỗi lưu thông tin nhân viên vào CSDL.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-3xl max-h-[92vh] flex flex-col bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200/80 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center font-bold">
              {isEditing ? <Save className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                {isEditing ? `Chỉnh sửa hồ sơ nhân viên (${id})` : 'Thêm mới nhân sự bệnh viện'}
              </h2>
              <p className="text-xs text-slate-500">
                Lưu trực tiếp vào CSDL SQLite `users` của bệnh viện
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Cụm 1: Hành chính & Nhận diện */}
          <div className="space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <span>1. Thông tin hành chính &amp; Liên lạc</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5">
              <div className="sm:col-span-3">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Mã nhân sự</label>
                <input
                  type="text"
                  disabled={isEditing}
                  value={id}
                  onChange={(e) => setId(e.target.value)}
                  placeholder="u-xxx"
                  className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-slate-50 font-mono text-xs text-slate-700 focus:bg-white focus:border-teal-600 focus:outline-none disabled:opacity-70"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Học hàm / Học vị</label>
                <select
                  value={academicTitle}
                  onChange={(e) => setAcademicTitle(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 focus:border-teal-600 focus:outline-none"
                >
                  {ACADEMIC_TITLES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-6">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Họ và tên đầy đủ <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ví dụ: BSCKII. Trần Văn Hùng"
                  className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:border-teal-600 focus:outline-none"
                />
              </div>

              <div className="sm:col-span-4">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Ngày sinh</label>
                <input
                  type="date"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs text-slate-700 focus:border-teal-600 focus:outline-none"
                />
              </div>

              <div className="sm:col-span-4">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Số điện thoại</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0912 345 678"
                  className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs text-slate-700 placeholder-slate-400 focus:border-teal-600 focus:outline-none"
                />
              </div>

              <div className="sm:col-span-4">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email công vụ</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="bs.hung@benhvien.vn"
                  className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs text-slate-700 placeholder-slate-400 focus:border-teal-600 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Cụm 2: Chuyên môn & Khoa phòng */}
          <div className="space-y-3 pt-3 border-t border-slate-100">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <span>2. Chuyên môn &amp; Khoa phòng công tác</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5">
              <div className="sm:col-span-4">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Vai trò hệ thống</label>
                <select
                  value={role}
                  onChange={(e) => handleRoleChange(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-800 focus:border-teal-600 focus:outline-none cursor-pointer"
                >
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-4">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Chức danh hiển thị</label>
                <input
                  type="text"
                  required
                  value={roleName}
                  onChange={(e) => setRoleName(e.target.value)}
                  placeholder="Ví dụ: Bác Sĩ Điều Trị Ca Đêm"
                  className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs text-slate-800 focus:border-teal-600 focus:outline-none"
                />
              </div>

              <div className="sm:col-span-4">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Khoa / Phòng ban</label>
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-800 focus:border-teal-600 focus:outline-none cursor-pointer"
                >
                  {DEPARTMENTS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-6">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Chứng chỉ hành nghề (CCHN) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={practiceCertificate}
                  onChange={(e) => setPracticeCertificate(e.target.value)}
                  placeholder="Ví dụ: 002341/HN-CCHN"
                  className="w-full h-9 px-3 rounded-lg border border-slate-200 font-mono text-xs text-slate-800 focus:border-teal-600 focus:outline-none uppercase"
                />
              </div>

              <div className="sm:col-span-6">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Mã thẻ RFID / NFC ca trực</label>
                <input
                  type="text"
                  required
                  value={rfidCardId}
                  onChange={(e) => setRfidCardId(e.target.value)}
                  placeholder="RFID-DOC-xxxx"
                  className="w-full h-9 px-3 rounded-lg border border-slate-200 font-mono text-xs text-slate-800 focus:border-teal-600 focus:outline-none"
                />
              </div>

              <div className="sm:col-span-12">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Trách nhiệm pháp lý &amp; Phân công</label>
                <textarea
                  rows={2}
                  value={responsibilities}
                  onChange={(e) => setResponsibilities(e.target.value)}
                  placeholder="Mô tả phạm vi thực hiện ca trực, quyền ký duyệt hồ sơ bệnh án..."
                  className="w-full p-2.5 rounded-lg border border-slate-200 text-xs text-slate-800 focus:border-teal-600 focus:outline-none resize-none"
                />
              </div>
            </div>
          </div>

          {/* Cụm 3: Bảo mật ca trực & Trạng thái */}
          <div className="space-y-3 pt-3 border-t border-slate-100">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <span>3. Xác thực ca trực &amp; Trạng thái công tác</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5 items-center">
              <div className="sm:col-span-6">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Mã PIN xác thực ca trực (4-6 số)</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={pinCode}
                    onChange={(e) => setPinCode(e.target.value.replace(/\D/g, ''))}
                    className="flex-1 h-9 px-3 rounded-lg border border-slate-200 font-mono font-bold tracking-widest text-sm text-slate-900 focus:border-teal-600 focus:outline-none text-center"
                  />
                  <button
                    type="button"
                    onClick={handleGeneratePin}
                    className="h-9 px-3 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-medium text-slate-600 flex items-center gap-1.5 transition"
                    title="Tạo mã PIN ngẫu nhiên"
                  >
                    <Key className="w-3.5 h-3.5 text-slate-500" />
                    <span>Tạo PIN</span>
                  </button>
                </div>
              </div>

              <div className="sm:col-span-6 flex items-center justify-between sm:justify-start gap-4 sm:pt-4">
                <label className="text-xs font-semibold text-slate-700">Trạng thái công tác:</label>
                <button
                  type="button"
                  onClick={() => setIsActive(!isActive)}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                    isActive
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300 shadow-2xs'
                      : 'bg-slate-100 text-slate-600 border-slate-300'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-emerald-600' : 'bg-slate-400'}`}></span>
                  <span>{isActive ? 'Đang công tác (Active)' : 'Tạm ngưng công tác'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Cụm 4: Tài khoản Web & Xác thực Mật khẩu */}
          <div className="space-y-3 pt-3 border-t border-slate-100">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-teal-700" />
                <span>4. Tài khoản Đăng nhập Web &amp; Mật khẩu bảo mật</span>
              </span>
              <span className="text-3xs font-mono font-normal text-slate-400">
                Argon2id · Không lưu Plaintext
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5">
              {/* Tên đăng nhập (Username) */}
              <div className="sm:col-span-6">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tên đăng nhập (Username)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.-]/g, ''))}
                    placeholder="VD: bs_hung, dd_thu"
                    className="flex-1 h-9 px-3 rounded-lg border border-slate-200 font-mono text-xs text-slate-900 focus:border-teal-600 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleSuggestUsername}
                    disabled={!name.trim()}
                    className="h-9 px-2.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-teal-50 hover:border-teal-300 text-xs font-medium text-slate-700 flex items-center gap-1 transition cursor-pointer disabled:opacity-50"
                    title="Gợi ý tên đăng nhập từ họ tên"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-teal-700" />
                    <span>Gợi ý</span>
                  </button>
                </div>
                <p className="text-3xs text-slate-400 mt-1">Dùng để đăng nhập hệ thống buồng bệnh qua Web.</p>
              </div>

              {/* Mật khẩu khởi tạo / thay đổi */}
              <div className="sm:col-span-6">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {isEditing ? 'Mật khẩu mới (để trống nếu giữ nguyên)' : 'Mật khẩu ban đầu'}
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={isEditing ? '••••••••' : 'Nhập mật khẩu...'}
                      className="w-full h-9 px-3 pr-8 rounded-lg border border-slate-200 font-mono text-xs text-slate-900 focus:border-teal-600 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                      title={showPassword ? 'Ẩn' : 'Hiện'}
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={handleGeneratePassword}
                    className="h-9 px-2.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-medium text-slate-700 flex items-center gap-1 transition cursor-pointer"
                    title="Tạo mật khẩu an toàn ngẫu nhiên"
                  >
                    <Key className="w-3.5 h-3.5 text-slate-500" />
                    <span>Tạo MK</span>
                  </button>
                </div>
                <p className="text-3xs text-slate-400 mt-1">Tối thiểu 6 ký tự. Mã hóa an toàn chuẩn Argon2id.</p>
              </div>

              {/* Bắt buộc đổi mật khẩu */}
              <div className="sm:col-span-12">
                <label className="flex items-center gap-2.5 p-2.5 bg-slate-50/70 rounded-lg border border-slate-200/80 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={mustChangePassword}
                    onChange={(e) => setMustChangePassword(e.target.checked)}
                    className="rounded text-teal-700 focus:ring-teal-600 cursor-pointer"
                  />
                  <div className="text-xs">
                    <span className="font-semibold text-slate-800">
                      Yêu cầu nhân viên đổi mật khẩu ở lần đăng nhập đầu tiên
                    </span>
                    <span className="text-3xs text-slate-500 block">
                      Khuyến nghị chính sách an toàn thông tin y tế ISO 27001 và HIS bệnh viện.
                    </span>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 transition"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition disabled:opacity-50"
            >
              {isSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              <span>{isEditing ? 'Lưu thay đổi vào CSDL' : 'Thêm nhân viên vào CSDL'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
