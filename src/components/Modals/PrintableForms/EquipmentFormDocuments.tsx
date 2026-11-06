import React from 'react';
import { Blank, Value, Fields, Section, SourceTable, DemoSource, Parties, SourceRef, type FormSourceData } from './documentParts';

export function AssetTransferDraft({ asset }: FormSourceData) {
  return <>
    <DemoSource />
    <Fields values={[
      ['ID tài sản nguồn', asset?.id], ['Mã tài sản nguồn', asset?.code], ['Tên / model nguồn', asset ? `${asset.deviceName} / ${asset.model}` : undefined], ['Serial nguồn', asset?.serialNumber], ['Phân loại nguồn', asset?.riskClass], ['Đơn vị theo sổ nguồn', asset?.registeredDepartment], ['Vị trí ghi nhận trên nguồn', asset?.actualDepartment], ['Tình trạng ghi trên nguồn', asset?.condition],
    ]} />
    <SourceTable headers={['Hồ sơ nguồn', 'Tài sản', 'Serial', 'Số lượng thực giao', 'ĐVT', 'Giá trị đã được đối chiếu', 'Hiện trạng thực kiểm']} empty={!asset}>
      {asset && <tr data-source-row={asset.id}><td><SourceRef id={asset.id} code={asset.code} /></td><td>{asset.deviceName}</td><td>{asset.serialNumber}</td><td><Blank /></td><td><Blank /></td><td><Blank /></td><td><Blank /></td></tr>}
    </SourceTable>
    <Fields values={[
      ['Căn cứ điều chuyển đã xác minh', undefined], ['Đơn vị / đại diện bên giao', undefined], ['Đơn vị / đại diện bên nhận', undefined], ['Phụ kiện / hồ sơ kèm theo thực giao', undefined], ['Thời điểm giao nhận thực tế', undefined], ['Kết quả kiểm tra khi nhận', undefined], ['Kết luận / nội dung chưa thống nhất', undefined],
    ]} />
    <Parties roles={['Bên giao', 'Bên nhận', 'Người chứng kiến']} />
  </>;
}

export function EquipmentInspectionDraft({ ticket }: FormSourceData) {
  return <>
    <DemoSource />
    <Section title="Thông tin thiết bị và sự cố từ nguồn"><Fields values={[
      ['ID phiếu nguồn', ticket?.id], ['Mã phiếu nguồn', ticket?.code], ['Thiết bị nguồn', ticket?.deviceName], ['Model nguồn', ticket?.deviceModel], ['Serial nguồn', ticket?.serialNumber], ['Phân loại nguồn', ticket?.riskClass], ['Vị trí nguồn', ticket?.location], ['Sự cố / phụ kiện trên nguồn', ticket?.accessoryIssue], ['Trạng thái phiếu nguồn', ticket?.status], ['Thời điểm báo trên nguồn', ticket?.reportTime], ['Lần kiểm tra ghi trên nguồn', ticket?.lastInspectionDate], ['Lịch kiểm tra ghi trên nguồn', ticket?.nextInspectionDue], ['Đơn vị kiểm tra ghi trên nguồn', ticket?.inspectionUnit],
    ]} /></Section>
    <Section title="Phép đo / kiểm tra cần ghi nhận"><p>Các hàng dưới đây là trường chờ điền, chưa có phép đo, giới hạn đối chiếu hoặc kết quả kiểm tra được cung cấp.</p>
      <SourceTable headers={['Hạng mục', 'Thiết bị / phương pháp đo', 'Giá trị đo', 'Đơn vị', 'Giới hạn đã xác minh', 'Kết quả']} empty={false}>
        {['Nối đất / an toàn điện', 'Dòng rò', 'Thử tải / chức năng', 'Phụ kiện / cảnh báo'].map(label => <tr key={label}><td>{label}</td><td><Blank /></td><td><Blank /></td><td><Blank /></td><td><Blank /></td><td><Blank field="measurement-result" /></td></tr>)}
      </SourceTable>
    </Section>
    <Fields values={[['Người / đơn vị thực hiện kiểm tra', undefined], ['Thời gian kiểm tra thực tế', undefined], ['Hồ sơ chứng minh kèm theo', undefined], ['Kết luận khả năng sử dụng', undefined], ['Lịch xem xét tiếp theo được xác nhận', undefined]]} />
    <Parties roles={['Người kiểm tra', 'Người tiếp nhận', 'Người xem xét']} />
  </>;
}

export function AssetAuditDraft({ assets }: FormSourceData) {
  return <>
    <DemoSource />
    <SourceTable headers={['Mã / ID nguồn', 'Thiết bị / model', 'Serial', 'Đơn vị theo sổ nguồn', 'Vị trí nguồn', 'Tình trạng nguồn', 'SL thực kiểm / ĐVT', 'Kết quả đối chiếu']} empty={!assets.length}>
      {assets.map(asset => <tr key={asset.id} data-source-row={asset.id}><td><SourceRef id={asset.id} code={asset.code} /></td><td>{asset.deviceName}<br />{asset.model}</td><td>{asset.serialNumber}</td><td>{asset.registeredDepartment}</td><td>{asset.actualDepartment}</td><td>{asset.condition}</td><td><Blank /></td><td><Blank /></td></tr>)}
    </SourceTable>
    <Fields values={[['Thành phần kiểm kê thực tế', undefined], ['Phạm vi / thời điểm kiểm kê', undefined], ['Chênh lệch đã xác nhận', undefined], ['Giá trị được đối chiếu và chứng từ', undefined], ['Kiến nghị của người kiểm kê', undefined], ['Kết luận', undefined]]} />
    <Parties roles={['Người kiểm kê', 'Đại diện đơn vị quản lý', 'Người xem xét']} />
  </>;
}
