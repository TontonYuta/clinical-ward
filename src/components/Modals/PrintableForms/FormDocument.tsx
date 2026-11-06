import React from 'react';
import type { PrintableFormType } from '../PrintableFormModal';
import { FORM_PRESENTATION } from './formModel';
import { Fields, type FormSourceData } from './documentParts';
import { AmpouleDraft, RestockDraft, BorrowDraft } from './MedicationFormDocuments';
import { AssetTransferDraft, EquipmentInspectionDraft, AssetAuditDraft } from './EquipmentFormDocuments';
import { ColdChainDraft, ShiftDraft } from './OperationalFormDocuments';

export function FormDocument({ formType, data }: { formType: PrintableFormType; data: FormSourceData }) {
  const body: Record<PrintableFormType, React.ReactNode> = {
    TT20_AMPOULE_DESTRUCTION: <AmpouleDraft {...data} />,
    TT22_RESTOCK_PROPOSAL: <RestockDraft {...data} />,
    TSC_HANDOVER_TRANSFER: <AssetTransferDraft {...data} />,
    EMERGENCY_BORROW_TICKET: <BorrowDraft {...data} />,
    EQUIPMENT_HANDOVER_INSPECT: <EquipmentInspectionDraft {...data} />,
    TSC_ANNUAL_AUDIT: <AssetAuditDraft {...data} />,
    COLD_CHAIN_INCIDENT_REPORT: <ColdChainDraft {...data} />,
    SHIFT_HANDOVER_RECORD: <ShiftDraft {...data} />,
  };
  return <div id="printable-medical-document" className="medical-document-content draft-document" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
    <style>{`.draft-document{font-size:11px;line-height:1.4;color:#000}.draft-document h1{font-size:16px;text-align:center;margin:8px 0}.draft-document h2{font-size:12px;margin:10px 0 4px}.draft-document p{margin:5px 0}.draft-status{text-align:center;font-weight:bold;border:2px solid #000;padding:5px}.draft-fields{display:grid;grid-template-columns:1fr 1fr;gap:5px 16px;margin:8px 0}.draft-fields>div{border-bottom:1px dotted #777;padding-bottom:3px}.draft-fields dt{font-weight:bold}.draft-fields dd{margin:0}.draft-table{width:100%;border-collapse:collapse;table-layout:fixed;margin:8px 0;font-size:10px;overflow-wrap:anywhere}.draft-table th,.draft-table td{white-space:normal;overflow-wrap:anywhere;min-width:0;border:1px solid #000;padding:4px;vertical-align:top}.draft-table thead{display:table-header-group}.draft-table tr{break-inside:avoid}.draft-source-note{border:1px solid #555;padding:6px}.draft-source-id{font-size:9px}.draft-blank{font-style:italic;color:#333}.draft-parties{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;border-top:1px solid #000;margin-top:12px;padding-top:8px;break-inside:avoid}.draft-parties strong{display:block}.draft-footer{border-top:1px solid #555;margin-top:12px;padding-top:5px;font-style:italic}@media print{.draft-document{color:#000}.draft-table tr{page-break-inside:avoid}.draft-parties{page-break-inside:avoid;break-after:avoid}body:has(#printable-medical-document) *:not(#printable-medical-document):not(#printable-medical-document *):not(:has(#printable-medical-document)){display:none!important}}`}</style>
    <div className="draft-status">DỰ THẢO — CHƯA XÁC MINH</div>
    <Fields values={[
      ['Cơ sở', undefined], ['Địa chỉ', undefined], ['Mã văn bản', undefined], ['Ngày lập / họp', undefined], ['Địa điểm', undefined], ['Căn cứ / mẫu pháp lý đã được xác minh', undefined],
    ]} />
    <h1>{FORM_PRESENTATION[formType].title}</h1>
    {body[formType]}
    <p className="draft-footer">Bản nháp hỗ trợ ghi chép. Chưa có xác nhận pháp lý, chữ ký, thẩm định hoặc chứng cứ hoàn tất nghiệp vụ. Các trường chưa có dữ liệu phải được đối chiếu và ghi nhận từ hồ sơ thực tế.</p>
  </div>;
}
