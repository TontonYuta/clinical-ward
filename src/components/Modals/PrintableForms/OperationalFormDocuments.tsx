import React from 'react';
import { Blank, Value, Fields, Section, SourceTable, DemoSource, Parties, SourceRef, lowStockBatches, type FormSourceData } from './documentParts';

export function ColdChainDraft({ coldChainState: state, batches }: FormSourceData) {
  const coldBatches = batches.filter(batch => (batch.coldStorageRequired || batch.coldChainStateId != null) && (!batch.coldStorageLinkVerified || state?.storageId == null || batch.coldChainStateId === state.storageId));
  return <>
    <p>Nguồn: trạng thái tủ, nhật ký và các lô được truyền vào ứng dụng. Không tự xác nhận cảm biến, kết quả thẩm định hay quyền giải phóng lô.</p>
    <Fields values={[
      ['ID tủ trong nguồn', state?.storageId], ['Tên tủ trong nguồn', state?.storageName], ['Nhiệt độ hiện tại ghi nhận (°C)', state?.currentTemp], ['Độ ẩm ghi nhận (% RH)', state?.currentHumidity], ['Trạng thái nguồn điện ghi nhận', state?.powerStatus], ['Trạng thái biệt trữ ghi nhận', state?.quarantineStatus], ['Lý do ghi nhận', state?.quarantineReason], ['VVM tổng hợp ghi trên trạng thái tủ', state?.vvmStage], ['MKT ghi nhận (°C)', state?.mktTemperature], ['Thời gian sự cố ghi nhận (phút)', state?.outageMinutes], ['Tổng ghi nhận trên tủ — chưa đối soát tồn', state?.totalVaccineDoses],
    ]} />
    <p>Số tổng hợp trên tủ không được coi là tổng tồn của các lô bên dưới; không cộng hoặc đổi đơn vị giữa liều, lọ hay đơn vị khác.</p>
    <Section title="Nhật ký được cung cấp"><SourceTable headers={['Thời điểm trên nguồn', 'Nhiệt độ (°C)', 'Độ ẩm (% RH)', 'Trạng thái trên nguồn']} empty={!state?.logs.length}>
      {state?.logs.map((log, index) => <tr key={index}><td>{log.timestamp}</td><td><Value value={log.temperature} /></td><td><Value value={log.humidity} /></td><td>{log.status}</td></tr>)}
    </SourceTable></Section>
    <Section title="Lô bảo quản lạnh cần đối chiếu"><SourceTable headers={['ID / tên lô', 'Số lô / hạn dùng', 'Tồn / ĐVT nguồn', 'Vị trí / liên kết tủ', 'Trạng thái giữ trên nguồn', 'VVM thực kiểm', 'Phép kiểm tra khác', 'Kết luận từng lô']} empty={!coldBatches.length}>
      {coldBatches.map(batch => <tr key={batch.id} data-source-row={batch.id}><td>{batch.id}<br />{batch.itemName}</td><td>{batch.batchNumber}<br />{batch.expiryDate}</td><td><Value value={batch.currentStock} /> {batch.unit}</td><td>{batch.warehouseLocation}<br />{batch.coldStorageLinkVerified ? `Đã liên kết tủ ${batch.coldChainStateId}` : 'Chưa xác nhận liên kết tủ'}</td><td><Value value={batch.dispatchHoldReason} /></td><td><Blank field="lot-vvm" /></td><td><Blank /></td><td><Blank /></td></tr>)}
    </SourceTable></Section>
    <Fields values={[['Diễn biến / nguyên nhân được xác nhận', undefined], ['Biện pháp đã thực hiện và chứng cứ', undefined], ['Thành phần thẩm định thực tế', undefined], ['Kết luận / quyết định xử lý được xác nhận', undefined]]} />
    <Parties roles={['Người ghi nhận', 'Người kiểm tra lô', 'Người xem xét']} />
  </>;
}

export function ShiftDraft({ debts, tickets, assets, batches, coldChainState }: FormSourceData) {
  const openDebts = debts.filter(debt => debt.status === 'debt');
  const openTickets = tickets.filter(ticket => ticket.status !== 'resolved');
  const openAssets = assets.filter(asset => asset.isMisallocated || asset.pendingLiquidation || asset.condition !== 'operational');
  const lowStock = lowStockBatches(batches);
  return <>
    <DemoSource />
    <p>Danh sách dưới đây chỉ tổng hợp các mục còn mở trong nguồn được truyền vào; không xác nhận ca trực hoặc tình hình lâm sàng đã diễn ra.</p>
    <Fields values={[
      ['Ca giao / khoảng thời gian', undefined], ['Ca nhận / khoảng thời gian', undefined], ['Số người bệnh hiện diện', undefined], ['Người bệnh mới nhận / chuyển', undefined], ['Diễn biến người bệnh cần bàn giao', undefined], ['Người phụ trách lâm sàng được xác nhận', undefined],
    ]} />
    <Section title="Phiếu tủ trực còn mở — nguồn mô phỏng"><SourceTable headers={['Mã / ID nguồn', 'Thuốc / số lượng nguồn', 'Người bệnh / vị trí nguồn', 'Trạng thái nguồn', 'Việc cần xác nhận tiếp']} empty={!openDebts.length}>
      {openDebts.map(debt => <tr key={debt.id} data-source-row={debt.id}><td><SourceRef id={debt.id} code={debt.code} /></td><td>{debt.itemName}<br />{debt.quantity}</td><td>{debt.patientName}<br />{debt.patientRoom}</td><td>{debt.status}</td><td><Blank /></td></tr>)}
    </SourceTable></Section>
    <Section title="Phiếu thiết bị còn mở — nguồn mô phỏng"><SourceTable headers={['Mã / ID nguồn', 'Thiết bị / serial', 'Vị trí nguồn', 'Sự cố / trạng thái nguồn', 'Việc cần xác nhận tiếp']} empty={!openTickets.length}>
      {openTickets.map(ticket => <tr key={ticket.id} data-source-row={ticket.id}><td><SourceRef id={ticket.id} code={ticket.code} /></td><td>{ticket.deviceName}<br />{ticket.serialNumber}</td><td>{ticket.location}</td><td>{ticket.accessoryIssue}<br />{ticket.status}</td><td><Blank /></td></tr>)}
    </SourceTable></Section>
    <Section title="Tài sản có mục cần đối chiếu — nguồn mô phỏng"><SourceTable headers={['Mã / ID nguồn', 'Tài sản / serial', 'Vị trí nguồn', 'Tình trạng nguồn', 'Việc cần xác nhận tiếp']} empty={!openAssets.length}>
      {openAssets.map(asset => <tr key={asset.id} data-source-row={asset.id}><td><SourceRef id={asset.id} code={asset.code} /></td><td>{asset.deviceName}<br />{asset.serialNumber}</td><td>{asset.actualDepartment}</td><td>{asset.condition}</td><td><Blank /></td></tr>)}
    </SourceTable></Section>
    <Section title="Lô tồn thấp theo dữ liệu nguồn"><SourceTable headers={['ID / số lô', 'Thuốc / vật tư', 'Tồn nguồn / ĐVT', 'Vị trí nguồn', 'Việc cần xác nhận tiếp']} empty={!lowStock.length}>
      {lowStock.map(batch => <tr key={batch.id} data-source-row={batch.id}><td>{batch.id}<br />{batch.batchNumber}</td><td>{batch.itemName}</td><td>{batch.currentStock} {batch.unit}</td><td>{batch.warehouseLocation}</td><td><Blank /></td></tr>)}
    </SourceTable></Section>
    <Fields values={[
      ['Nhiệt độ tủ trên nguồn (°C)', coldChainState?.currentTemp], ['Trạng thái biệt trữ trên nguồn', coldChainState?.quarantineStatus], ['Nội dung giao nhận thực tế', undefined], ['Các việc ưu tiên đã thống nhất', undefined], ['Kết luận bàn giao', undefined],
    ]} />
    <Parties roles={['Người giao ca', 'Người nhận ca', 'Người xem xét']} />
  </>;
}
