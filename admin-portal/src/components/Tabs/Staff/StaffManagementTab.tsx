import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Search,
  UserPlus,
  RefreshCw,
  Edit2,
  KeyRound,
  Eye,
  EyeOff,
  UserX,
  UserCheck,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import { StaffItem, StaffCreatePayload, StaffUpdatePayload } from '../../../types/staff';
import {
  fetchStaffList,
  createStaff,
  updateStaff,
  toggleStaffStatus,
  resetStaffPin,
  softDeleteStaff
} from '../../../services/staffApi';
import { StaffHeroMetrics } from './StaffHeroMetrics';
import { StaffModalCreateEdit } from './StaffModalCreateEdit';
import { StaffResetPinModal } from './StaffResetPinModal';

export const StaffManagementTab: React.FC = () => {
  const [items, setItems] = useState<StaffItem[]>([]);
  const [total, setTotal] = useState(0);
  const [activeCount, setActiveCount] = useState(0);
  const [suspendedCount, setSuspendedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [deptFilter, setDeptFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended'>('all');

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffItem | null>(null);
  const [resetPinStaff, setResetPinStaff] = useState<StaffItem | null>(null);
  const [revealedPins, setRevealedPins] = useState<Record<string, boolean>>({});

  // Show toast notification
  const notify = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Load staff data from SQLite via API
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchStaffList({
        search: search.trim() || undefined,
        role: roleFilter,
        department: deptFilter,
        status: statusFilter,
      });
      setItems(res.items);
      setTotal(res.total);
      setActiveCount(res.active_count);
      setSuspendedCount(res.suspended_count);
    } catch (err: any) {
      setError(err.message || 'Lỗi tải danh sách nhân viên từ CSDL.');
    } finally {
      setLoading(false);
    }
  }, [search, roleFilter, deptFilter, statusFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle Create / Update Submit
  const handleSaveStaff = async (payload: StaffCreatePayload | StaffUpdatePayload, isEditing: boolean) => {
    if (isEditing && editingStaff) {
      await updateStaff(editingStaff.id, payload as StaffUpdatePayload);
      notify(`Đã cập nhật thành công hồ sơ ${editingStaff.name} vào CSDL!`);
    } else {
      await createStaff(payload as StaffCreatePayload);
      notify(`Đã thêm mới nhân sự ${payload.name} trực tiếp vào CSDL!`);
    }
    await loadData();
  };

  // Handle Quick Status Toggle
  const handleToggleStatus = async (staff: StaffItem) => {
    try {
      const targetState = !staff.is_active;
      await toggleStaffStatus(staff.id, targetState);
      notify(
        targetState
          ? `Đã kích hoạt hoạt động cho nhân sự ${staff.name}`
          : `Đã tạm ngưng công tác nhân sự ${staff.name}`
      );
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Không thể đổi trạng thái nhân sự.');
    }
  };

  // Handle Soft Delete (Suspend)
  const handleSoftDelete = async (staff: StaffItem) => {
    const confirmMsg = `Bạn có chắc muốn chuyển nhân sự "${staff.name}" (${staff.id}) sang trạng thái TẠM NGƯNG công tác?\n\nLưu ý: Dữ liệu hồ sơ bệnh án và lịch sử ký đơn thuốc vẫn được bảo toàn nguyên vẹn trong CSDL.`;
    if (!window.confirm(confirmMsg)) return;

    try {
      await softDeleteStaff(staff.id);
      notify(`Đã chuyển ${staff.name} sang trạng thái Tạm ngưng.`);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Lỗi khi tạm ngưng nhân viên.');
    }
  };

  // Handle Reset PIN
  const handleResetPin = async (id: string, newPin: string) => {
    await resetStaffPin(id, newPin);
    notify(`Đã đặt lại mã PIN mới thành công cho nhân sự ${id}!`);
    await loadData();
  };

  // Toggle reveal PIN code for row
  const togglePinReveal = (id: string) => {
    setRevealedPins((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Distinct departments for filter dropdown
  const departmentsList = useMemo(() => {
    const set = new Set<string>();
    items.forEach((it) => {
      if (it.department) set.add(it.department);
    });
    return Array.from(set);
  }, [items]);

  return (
    <div className="space-y-6 lg:space-y-7">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-18 right-6 z-50 p-3.5 bg-teal-900 text-white rounded-xl shadow-lg border border-teal-700/80 flex items-center gap-2.5 text-xs font-medium animate-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Hero Metric Ribbon */}
      <StaffHeroMetrics
        total={total}
        activeCount={activeCount}
        suspendedCount={suspendedCount}
        items={items}
      />

      {/* Main Staff Section: Flat & Seamless */}
      <div className="bg-white border border-slate-200/90 rounded-lg overflow-hidden flex flex-col">
        {/* Header & Tool Bar */}
        <div className="p-3 sm:px-4 sm:py-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-slate-900 tracking-tight">
              Danh Sách Nhân Sự Bệnh Viện
            </h2>
            <span className="text-xs font-mono text-slate-400">
              ({items.length})
            </span>
            {loading && <RefreshCw className="w-3.5 h-3.5 text-teal-600 animate-spin" />}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              className="p-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 transition disabled:opacity-50"
              title="Tải lại từ CSDL"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-teal-700' : ''}`} />
            </button>
            <button
              type="button"
              onClick={() => {
                setEditingStaff(null);
                setIsModalOpen(true);
              }}
              className="px-3 py-1.5 rounded-md bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold flex items-center gap-1.5 transition active:scale-98"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Thêm Nhân Viên</span>
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="px-3 sm:px-4 py-2.5 bg-slate-50/70 border-b border-slate-200/80 flex flex-wrap items-center gap-2.5">
          {/* Ô Tìm Kiếm Nhanh */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm theo tên, mã NV, CCHN, khoa phòng..."
              className="w-full h-8 pl-8 pr-2.5 bg-white border border-slate-300/80 rounded-md text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-teal-600 transition"
            />
          </div>

          {/* Lọc Vai Trò */}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="h-8 bg-white border border-slate-300/80 rounded-md px-2 text-xs font-medium text-slate-700 focus:border-teal-600 focus:outline-none cursor-pointer"
          >
            <option value="all">Mọi Vai Trò</option>
            <option value="doctor">Bác Sĩ</option>
            <option value="nurse">Điều Dưỡng</option>
            <option value="pharmacist">Dược Sĩ</option>
            <option value="biomedical_engineer">Kỹ Sư TBYT</option>
            <option value="director">Ban Giám Đốc</option>
          </select>

          {/* Lọc Khoa Phòng */}
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="h-8 bg-white border border-slate-300/80 rounded-md px-2 text-xs font-medium text-slate-700 focus:border-teal-600 focus:outline-none cursor-pointer max-w-[180px] truncate"
          >
            <option value="all">Mọi Khoa Phòng</option>
            {departmentsList.map((dept) => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>

          {/* Lọc Trạng Thái Công Tác */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="h-8 bg-white border border-slate-200 rounded-md px-2 text-xs text-slate-700 focus:border-slate-400 focus:outline-none cursor-pointer"
          >
            <option value="all">Mọi Trạng Thái</option>
            <option value="active">Đang trực</option>
            <option value="suspended">Tạm ngưng</option>
          </select>

          {/* Đặt lại bộ lọc */}
          {(search || roleFilter !== 'all' || deptFilter !== 'all' || statusFilter !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setRoleFilter('all');
                setDeptFilter('all');
                setStatusFilter('all');
              }}
              className="text-xs text-rose-600 hover:underline cursor-pointer font-medium ml-auto"
            >
              Đặt lại
            </button>
          )}
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/50 text-slate-500 font-semibold text-2xs uppercase tracking-wider">
                <th className="py-2.5 px-3">Nhân Sự</th>
                <th className="py-2.5 px-3">Vai Trò &amp; Chức Danh</th>
                <th className="py-2.5 px-3">Khoa / Phòng</th>
                <th className="py-2.5 px-3">Chứng Chỉ CCHN</th>
                <th className="py-2.5 px-3">Mã RFID / PIN</th>
                <th className="py-2.5 px-3 text-center">Trạng Thái</th>
                <th className="py-2.5 px-3 text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {error ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-xs text-rose-600">
                    <div className="flex items-center justify-center gap-1.5">
                      <AlertCircle className="w-4 h-4" />
                      <span>{error}</span>
                    </div>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-xs text-slate-400">
                    {loading ? 'Đang tải dữ liệu từ CSDL...' : 'Không tìm thấy nhân viên nào phù hợp với bộ lọc.'}
                  </td>
                </tr>
              ) : (
                items.map((staff) => {
                  const isPinVisible = Boolean(revealedPins[staff.id]);

                  return (
                    <tr
                      key={staff.id}
                      className="hover:bg-slate-50/80 transition group"
                    >
                      {/* Cột 1: Tên + Mã */}
                      <td className="py-2.5 px-3">
                        <div>
                          <div className="font-medium text-slate-900 group-hover:text-teal-900 flex items-center gap-1.5">
                            <span>{staff.name}</span>
                            {staff.academic_title && !staff.name.toLowerCase().includes(staff.academic_title.toLowerCase()) && (
                              <span className="text-2xs font-mono text-slate-400">
                                {staff.academic_title}
                              </span>
                            )}
                          </div>
                          <div className="text-3xs text-slate-400 flex items-center gap-1.5 font-mono">
                            <span>{staff.id.length > 10 ? `${staff.id.slice(0, 8)}...` : staff.id}</span>
                            {staff.phone && <span>· {staff.phone}</span>}
                          </div>
                        </div>
                      </td>

                      {/* Cột 2: Vai trò & Chức danh */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className="text-xs font-medium text-slate-700">
                          {staff.role_name}
                        </span>
                      </td>

                      {/* Cột 3: Khoa phòng */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="text-slate-800 text-xs font-medium truncate max-w-[160px] block">
                          {staff.department}
                        </span>
                      </td>

                      {/* Cột 4: Số CCHN */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="text-xs font-mono text-slate-800">
                          {staff.practice_certificate}
                        </span>
                      </td>

                      {/* Cột 5: Mã RFID & PIN */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="flex flex-col text-xs font-mono">
                          <span className="text-slate-500 text-2xs truncate max-w-[130px]" title={staff.rfid_card_id}>
                            {staff.rfid_card_id}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-900 tracking-wider">
                              {isPinVisible ? staff.pin_code : '••••'}
                            </span>
                            <button
                              type="button"
                              onClick={() => togglePinReveal(staff.id)}
                              className="text-slate-400 hover:text-slate-700 transition"
                              title={isPinVisible ? 'Ẩn mã PIN' : 'Hiện mã PIN'}
                            >
                              {isPinVisible ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                            </button>
                          </div>
                        </div>
                      </td>

                      {/* Cột 6: Trạng thái */}
                      <td className="py-3 px-3 whitespace-nowrap text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(staff)}
                          className="inline-flex items-center gap-1.5 text-xs font-medium transition cursor-pointer hover:opacity-80"
                          title="Nhấn để đổi trạng thái"
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${staff.is_active ? 'bg-emerald-500' : 'bg-slate-300'}`}></span>
                          <span className={staff.is_active ? 'text-slate-700' : 'text-slate-400'}>
                            {staff.is_active ? 'Đang công tác' : 'Tạm ngưng'}
                          </span>
                        </button>
                      </td>

                      {/* Cột 7: Thao tác */}
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          {/* Sửa thông tin */}
                          <button
                            type="button"
                            onClick={() => {
                              setEditingStaff(staff);
                              setIsModalOpen(true);
                            }}
                            className="p-1.5 rounded-md hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition"
                            title="Chỉnh sửa thông tin hồ sơ"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Đổi mã PIN */}
                          <button
                            type="button"
                            onClick={() => setResetPinStaff(staff)}
                            className="p-1.5 rounded-md hover:bg-slate-100 text-slate-600 hover:text-teal-700 transition"
                            title="Đặt lại mã PIN xác thực"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                          </button>

                          {/* Tạm ngưng (Soft Delete) */}
                          {staff.is_active ? (
                            <button
                              type="button"
                              onClick={() => handleSoftDelete(staff)}
                              className="p-1.5 rounded-md hover:bg-amber-50 text-slate-400 hover:text-amber-700 transition"
                              title="Tạm ngưng công tác nhân sự này"
                            >
                              <UserX className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleToggleStatus(staff)}
                              className="p-1.5 rounded-md hover:bg-emerald-50 text-slate-400 hover:text-emerald-700 transition"
                              title="Khôi phục trạng thái đang công tác"
                            >
                              <UserCheck className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info */}
        <div className="p-3 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between text-2xs text-slate-500">
          <span>Hiển thị {items.length} trên tổng số {total} nhân sự</span>
          <span className="font-mono">CSDL: SQLite `clinical_hospital.db`</span>
        </div>
      </div>

      {/* Modals */}
      <StaffModalCreateEdit
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingStaff(null);
        }}
        onSubmit={handleSaveStaff}
        editingStaff={editingStaff}
      />

      <StaffResetPinModal
        staff={resetPinStaff}
        isOpen={Boolean(resetPinStaff)}
        onClose={() => setResetPinStaff(null)}
        onResetPin={handleResetPin}
      />
    </div>
  );
};
