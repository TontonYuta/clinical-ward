import React from 'react';
import { Blank, Value, Fields, Section, SourceTable, DemoSource, Parties, SourceRef, quantityParts, isReturnedControlledDebt, lowStockBatches, type FormSourceData } from './documentParts';

export function AmpouleDraft({ debts }: FormSourceData) {
  const returned = debts.filter(isReturnedControlledDebt);
  return <>
    <DemoSource />
    <p>Danh sách đề nghị đối chiếu vỏ đã được ghi nhận trả và chưa ghi nhận hủy. Số lượng thuốc trên phiếu không thay thế số vỏ thực kiểm.</p>
    <SourceTable headers={['Hồ sơ nguồn', 'Thuốc trên nguồn', 'SL trên phiếu', 'ĐVT', 'Người bệnh / vị trí', 'Lô / hạn dùng', 'Số vỏ thực kiểm']} empty={!returned.length}>
      {returned.map(debt => { const quantity = quantityParts(debt.quantity); return <tr key={debt.id} data-source-row={debt.id}><td><SourceRef id={debt.id} code={debt.code} /></td><td>{debt.itemName}</td><td><Value value={quantity.amount} /></td><td><Value value={quantity.unit} /></td><td>{debt.patientName}<br />{debt.patientRoom}</td><td><Blank /></td><td><Blank /></td></tr>; })}
    </SourceTable>
    <Section title="Nội dung cần xác nhận trước và sau thực hiện"><Fields values={[
      ['Căn cứ / quyết định đã xác minh', undefined], ['Thành phần tham gia', undefined], ['Phương pháp dự kiến', undefined], ['Số vỏ thực kiểm và đối chiếu', undefined], ['Thời gian bắt đầu / kết thúc', undefined], ['Kết quả thực hiện', undefined], ['Bàn giao chất thải / lưu hồ sơ', undefined], ['Kết luận', undefined],
    ]} /></Section>
    <Parties roles={['Người lập', 'Người kiểm đếm', 'Người xem xét / chứng kiến']} />
  </>;
}

export function RestockDraft({ batches }: FormSourceData) {
  const lowStock = lowStockBatches(batches);
  return <>
    <p>Nguồn: số liệu lô tồn kho được truyền vào. Gợi ý bổ sung chỉ là phép tính từ ngưỡng nguồn, chưa phải số lượng được duyệt hoặc thực cấp.</p>
    <Fields values={[['Đơn vị đề nghị', undefined], ['Đơn vị tiếp nhận', undefined], ['Lý do / thời hạn đề nghị', undefined]]} />
    <SourceTable headers={['Nguồn / lô / hạn', 'Thuốc / vật tư', 'ĐVT', 'Tồn nguồn', 'Ngưỡng min / max', 'Gợi ý bổ sung', 'SL đề nghị xác nhận', 'Thực cấp', 'Vị trí nguồn']} empty={!lowStock.length}>
      {lowStock.map(batch => <tr key={batch.id} data-source-row={batch.id}>
        <td>{batch.id}<br />{batch.batchNumber}<br />{batch.expiryDate}</td><td>{batch.itemName}</td><td>{batch.unit}</td><td><Value value={batch.currentStock} /></td><td><Value value={batch.minThreshold} /> / <Value value={batch.maxThreshold} /></td>
        <td><Value value={Number.isFinite(batch.maxThreshold) && Number.isFinite(batch.currentStock) ? Math.max(0, batch.maxThreshold - batch.currentStock) : undefined} /></td><td><Blank /></td><td><Blank field="actual-issued" /></td><td>{batch.warehouseLocation}</td>
      </tr>)}
    </SourceTable>
    <Fields values={[['Ý kiến xem xét', undefined], ['Số lượng được duyệt', undefined], ['Thời điểm và người thực cấp', undefined], ['Kết luận / đối chiếu khi nhận', undefined]]} />
    <Parties roles={['Người lập đề nghị', 'Người xem xét', 'Người giao / nhận thực tế']} />
  </>;
}

export function BorrowDraft({ debt }: FormSourceData) {
  const quantity = quantityParts(debt?.quantity);
  return <>
    <DemoSource />
    <Section title="Thông tin từ phiếu nguồn"><Fields values={[
      ['ID hồ sơ nguồn', debt?.id], ['Mã phiếu nguồn', debt?.code], ['Tên người bệnh trên nguồn', debt?.patientName], ['Mã người bệnh', undefined], ['Buồng / vị trí nguồn', debt?.patientRoom], ['Ngày trên nguồn', debt?.borrowDate], ['Giờ trên nguồn', debt?.borrowTime], ['Người mượn trên nguồn', debt?.borrowerName], ['Lý do trên nguồn', debt?.note], ['Trạng thái trên nguồn', debt?.status],
    ]} /></Section>
    <SourceTable headers={['Thuốc / vật tư nguồn', 'Phân loại nguồn', 'Số lượng nguồn', 'ĐVT', 'Lô / hạn dùng', 'Thực giao', 'Thực nhận']} empty={!debt}>
      {debt && <tr data-source-row={debt.id}><td>{debt.itemName}</td><td>{debt.itemType}</td><td><Value value={quantity.amount} /></td><td><Value value={quantity.unit} /></td><td><Blank /></td><td><Blank /></td><td><Blank /></td></tr>}
    </SourceTable>
    <Fields values={[['Địa điểm / thời điểm giao nhận thực tế', undefined], ['Tình trạng khi giao nhận', undefined], ['Nội dung hoàn trả / đối chiếu', undefined], ['Kết luận', undefined]]} />
    <Parties roles={['Người đề nghị', 'Người giao', 'Người nhận']} />
  </>;
}
