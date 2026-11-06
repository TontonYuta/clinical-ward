import React, { useState } from 'react';
import { X, ArrowUpRight, BookOpen } from 'lucide-react';
import { useModalDismiss } from '../../hooks/useModalDismiss';
const documents = [
  {
    code: '26/2025/TT-BYT',
    title: 'Kê đơn thuốc ngoại trú',
    category: 'Đơn thuốc',
    description:
      'Quy định về đơn thuốc và việc kê đơn thuốc hóa dược, sinh phẩm trong điều trị ngoại trú.',
    scope:
      'Nội dung đơn, mẫu đơn và đơn thuốc điện tử. Không dùng văn bản này để thay thế quy định sử dụng thuốc nội trú.',
    url: 'https://datafiles.chinhphu.vn/cpp/files/vbpq/2025/7/26-byt.pdf',
    source: 'Cổng thông tin Chính phủ',
  },
  {
    code: '23/2011/TT-BYT',
    title: 'Sử dụng thuốc tại cơ sở có giường bệnh',
    category: 'Điều trị nội trú',
    description: 'Hướng dẫn sử dụng thuốc trong các cơ sở y tế có giường bệnh.',
    scope:
      'Đọc cùng các văn bản sửa đổi, bãi bỏ liên quan. Đối chiếu nội dung chỉ định và thực hiện thuốc với hồ sơ điều trị.',
    url: 'https://vbpl.moj.gov.vn/boyte/Pages/vbpq-print.aspx?ItemID=26731',
    source: 'Cơ sở dữ liệu quốc gia về văn bản pháp luật',
  },
  {
    code: '12/VBHN-BYT · 2025',
    title: 'Thực hành tốt bảo quản thuốc',
    category: 'Kho dược & bảo quản',
    description:
      'Văn bản hợp nhất quy định GSP, gồm Thông tư 36/2018/TT-BYT và các sửa đổi được hợp nhất năm 2025.',
    scope:
      'Đối chiếu đúng phạm vi cơ sở. Phụ lục IV áp dụng với cơ sở khám chữa bệnh và cơ sở tiêm chủng thuộc đối tượng quy định.',
    url: 'https://datafiles.chinhphu.vn/cpp/files/vbpq/2025/7/12-vbhn-byt.pdf',
    source: 'Cổng thông tin Chính phủ',
  },
  {
    code: '18/2026/TT-BYT',
    title: 'Thuốc phải kiểm soát đặc biệt',
    category: 'Kiểm soát đặc biệt',
    description:
      'Quy định một số nội dung về thuốc phải kiểm soát đặc biệt; thay thế Thông tư 20/2017/TT-BYT và Thông tư 27/2024/TT-BYT.',
    scope:
      'Có hiệu lực từ 16/07/2026. Cần đối chiếu quy trình, hồ sơ và điều kiện áp dụng trong văn bản gốc.',
    url: 'https://congbao.chinhphu.vn/van-ban/thong-tu-so-18-2026-tt-byt-469674/65587.htm',
    source: 'Công báo Chính phủ',
  },
  {
    code: '13/2026/TT-BYT',
    title: 'Hoạt động tiêm chủng',
    category: 'Vắc xin',
    description:
      'Quy định chi tiết một số điều của Nghị định 104/2016/NĐ-CP về hoạt động tiêm chủng.',
    scope:
      'Có hiệu lực từ 01/07/2026, thay thế Thông tư 34/2018/TT-BYT. Điều kiện bảo quản cần đối chiếu nhãn và hướng dẫn của từng sản phẩm.',
    url: 'https://bvdkbaclieu.gov.vn/upload/1000079/20260613/760_Thong-tu-13-2026-TT-BYT_92335354fb.pdf',
    source: 'Bệnh viện Đa khoa Bạc Liêu · bản PDF văn bản',
  },
  {
    code: '15/2023/QH15',
    title: 'Luật Khám bệnh, chữa bệnh',
    category: 'Hồ sơ & quyền người bệnh',
    description: 'Luật Khám bệnh, chữa bệnh năm 2023.',
    scope:
      'Tham chiếu Điều 10 về bí mật thông tin và Điều 69 về hồ sơ bệnh án khi thiết kế quyền truy cập dữ liệu người bệnh.',
    url: 'https://vbpl.moj.gov.vn/bonoivu/Pages/vbpq-toanvan.aspx?ItemID=168125',
    source: 'Cơ sở dữ liệu quốc gia về văn bản pháp luật',
  },
  {
    code: 'Dược thư quốc gia',
    title: 'Tài liệu chuyên môn dược',
    category: 'Chuyên môn',
    description: 'Bản tài liệu đang được đóng gói trong ứng dụng.',
    scope: 'Tài liệu chuyên môn tham khảo; không phải văn bản thay thế quy định pháp luật.',
    url: '/pdf/Duoc_Thu_Quoc_Gia_Viet_Nam.pdf',
    source: 'Tài liệu cục bộ',
  },
];
export const LegalDocsModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({
  isOpen,
  onClose,
}) => {
  useModalDismiss(isOpen, onClose);
  const [selected, setSelected] = useState(0);
  if (!isOpen) return null;
  const doc = documents[selected];
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Văn bản và tài liệu"
      className="clinical-modal-overlay fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-5"
    >
      <div className="bg-white w-full max-w-5xl h-[100dvh] sm:h-[85vh] flex flex-col overflow-hidden">
        <header className="library-header">
          <div>
            <h2>Văn bản & tài liệu</h2>
          </div>
          <button
            type="button"
            className="icon-action"
            aria-label="Đóng thư viện"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </header>
        <div className="library-body">
          <nav className="library-navigation" aria-label="Danh mục tài liệu">
            {documents.map((d, i) => (
              <button
                type="button"
                key={d.code}
                aria-current={selected === i ? 'true' : undefined}
                onClick={() => setSelected(i)}
              >
                <span>{d.code}</span>
                <small>{d.category}</small>
              </button>
            ))}
          </nav>
          <article className="library-article">
            <BookOpen size={32} strokeWidth={1.3} />

            <h3>{doc.title}</h3>
            <p className="record-mono mt-4">{doc.code}</p>
            <p className="mt-8">{doc.description}</p>
            <section className="library-scope">
              <h4>Phạm vi tham chiếu</h4>
              <p>{doc.scope}</p>
            </section>
            <a
              className="button-primary mt-6"
              href={doc.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              Mở văn bản gốc
              <ArrowUpRight size={17} />
            </a>
            <p className="record-sub mt-4">Nguồn: {doc.source}</p>
          </article>
        </div>
        <footer className="library-footer">
          Danh mục đối chiếu ngày 05/11/2026. Luôn kiểm tra văn bản gốc và sửa đổi áp dụng cho cơ
          sở.
        </footer>
      </div>
    </div>
  );
};
