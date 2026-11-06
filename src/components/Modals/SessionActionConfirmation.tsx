import React, {useEffect, useRef, useState} from 'react';
import type {ClinicalAuthRequest, UserRole} from '../../types/auth';
import {USER_PROFILES} from '../../data/initialData';

export function SessionActionConfirmation({isOpen,request,currentUserRole,username,onClose}:{isOpen:boolean;request:ClinicalAuthRequest|null;currentUserRole:UserRole;username:string;onClose:()=>void}) {
  const [pending,setPending]=useState(false), [error,setError]=useState('');
  const inFlight=useRef(false);
  useEffect(()=>{setError('');},[isOpen,request]);
  if(!isOpen || !request) return null;
  const authorized=request.requiredRoles.includes(currentUserRole);
  const needsWitness=Boolean(request.requiresDualWitness);
  async function confirm() {
    if(inFlight.current || !request || !authorized || needsWitness) return;
    inFlight.current=true;setPending(true);setError('');
    try {
      await request.onConfirm({...USER_PROFILES[currentUserRole],name:username,practiceCertificate:'',pinCode:'',rfidCardId:'',department:''}, undefined, 'SESSION');
      onClose();
    } catch(e) {setError(e instanceof Error?e.message:'Máy chủ chưa xác nhận thao tác.');}
    finally {inFlight.current=false;setPending(false);}
  }
  return <div role="dialog" aria-modal="true" aria-labelledby="session-action-title" className="clinical-modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
    <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
      <h2 id="session-action-title" className="text-lg font-semibold">Xác nhận thao tác</h2>
      <p className="mt-3 font-semibold">{request.title}</p><p className="mt-2 text-sm text-slate-700">{request.description}</p>
      <p className="mt-3 text-sm">Đối tượng: {request.targetItem}</p>
      <p className="mt-3 text-sm">Tài khoản đang đăng nhập: <strong>{username}</strong></p>
      <p className="mt-1 text-xs text-slate-600">Máy chủ kiểm tra quyền tài khoản khi thực hiện. Xác nhận này không phải chữ ký số hoặc xác minh giấy phép hành nghề.</p>
      {!authorized && <p role="alert" className="mt-3 text-sm text-red-800">Tài khoản không có quyền thực hiện thao tác.</p>}
      {needsWitness && <p role="alert" className="mt-3 text-sm text-amber-900">Yêu cầu có người chứng kiến độc lập. Chưa tích hợp xác nhận người thứ hai từ máy chủ nên chưa thể thực hiện bằng phiên này.</p>}
      {error && <p role="alert" className="mt-3 text-sm text-red-800">{error}</p>}
      <div className="mt-5 flex justify-end gap-2"><button type="button" disabled={pending} onClick={onClose} className="button-secondary">Hủy</button><button type="button" disabled={pending||!authorized||needsWitness} onClick={confirm} className="button-primary">{pending?'Đang chờ máy chủ…':'Xác nhận thao tác'}</button></div>
    </div>
  </div>;
}
