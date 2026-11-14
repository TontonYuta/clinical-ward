/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Bộ Phân Giải Đường Dẫn & Số Trang Tài Liệu Pháp Lý / Y Văn Đối Chứng (PDF Document Resolver)
 * Phân biệt chuẩn xác giữa các Thông tư / Quyết định, giải quyết triệt để lỗi xung đột mã văn bản:
 * - Thông tư 20/2022/TT-BYT (Danh mục thuốc BHYT) vs Thông tư 20/2017/TT-BYT (Thuốc gây nghiện)
 * - Quyết định 3618/QĐ-BHXH (Quy trình giám định BHYT)
 * - Quyết định 130/QĐ-BYT (Chuẩn dữ liệu XML BHYT)
 * - Quyết định 5948/QĐ-BYT (Danh mục tương tác thuốc chống chỉ định)
 * - Dược Thư Quốc Gia Việt Nam 2015
 */

export interface ResolvedPdfTarget {
  pdfUrl: string;
  pageNumber: number;
  documentTitle: string;
  exactHashUrl: string;
}

export function resolvePdfDocumentTarget(
  rawInput: string | { url?: string; docCode?: string; title?: string; page?: number; legal_basis?: string } | null | undefined,
  explicitPage?: number
): ResolvedPdfTarget {
  let docCode = '';
  let url = '';
  let title = '';
  let page = explicitPage || 1;

  if (typeof rawInput === 'string') {
    docCode = rawInput;
    url = rawInput;
  } else if (rawInput && typeof rawInput === 'object') {
    docCode = rawInput.docCode || rawInput.legal_basis || rawInput.title || '';
    url = rawInput.url || '';
    title = rawInput.title || rawInput.legal_basis || '';
    if (rawInput.page && !explicitPage) {
      page = Number(rawInput.page) || 1;
    }
  }

  const combinedSearch = `${docCode} ${url} ${title}`.toLowerCase();

  // A citation URL comes from the retrieved source record and is the canonical
  // document identity. Do not reinterpret a valid PDF path using title keywords.
  if (url.startsWith('/pdf/') || /^https?:\/\//i.test(url) && url.toLowerCase().includes('.pdf')) {
    const resolvedPath = url.split('#')[0];
    const hashPage = url.match(/#page=(\d+)/i)?.[1];
    if (hashPage) page = Number(hashPage);
    const safePage = Math.max(1, Math.floor(page));
    return {
      pdfUrl: resolvedPath,
      pageNumber: safePage,
      documentTitle: title || 'Tài liệu nguồn',
      exactHashUrl: `${resolvedPath}#page=${safePage}`,
    };
  }

  // 1. Nếu URL đã chứa sẵn số trang trong hash
  if (url && url.includes('#page=')) {
    const pageMatch = url.match(/#page=(\d+)/i);
    if (pageMatch && pageMatch[1]) {
      page = parseInt(pageMatch[1], 10);
    }
  }

  // 2. Phân giải tài liệu cụ thể
  let resolvedPath = '';
  let resolvedTitle = '';

  if (combinedSearch.includes('dược thư') || combinedSearch.includes('duoc thu') || combinedSearch.includes('dtqg')) {
    resolvedPath = '/pdf/Duoc_Thu_Quoc_Gia_Viet_Nam.pdf';
    resolvedTitle = 'Dược Thư Quốc Gia Việt Nam (Ấn bản II - 2015)';
  } else if (combinedSearch.includes('20/2022') || combinedSearch.includes('thanh_toan_thuoc_bhyt')) {
    resolvedPath = '/pdf/bhyt/Thong_Tu_20_2022_TT_BYT_Danh_Muc_Thanh_Toan_Thuoc_BHYT.pdf';
    resolvedTitle = 'Thông tư 20/2022/TT-BYT (Danh Mục Thuốc Thanh Toán BHYT)';
  } else if (combinedSearch.includes('3618') || combinedSearch.includes('giam_dinh_bhyt')) {
    resolvedPath = '/pdf/bhyt/Quyet_Dinh_3618_QD_BHXH_2022_Quy_Trinh_Giam_Dinh_BHYT.pdf';
    resolvedTitle = 'Quyết định 3618/QĐ-BHXH (Quy Trình Giám Định BHYT)';
  } else if (combinedSearch.includes('130') || combinedSearch.includes('chuan_du_lieu')) {
    resolvedPath = '/pdf/bhyt/Quyet_Dinh_130_QD_BYT_2023_Chuan_Du_Lieu_Dau_Ra_BHYT.pdf';
    resolvedTitle = 'Quyết định 130/QĐ-BYT (Chuẩn Dữ Liệu Đầu Ra BHYT)';
  } else if (combinedSearch.includes('146/2018') || combinedSearch.includes('nd_146')) {
    resolvedPath = '/pdf/bhyt/Nghi_Dinh_146_2018_ND_CP_Huong_Dan_Luat_BHYT.pdf';
    resolvedTitle = 'Nghị định 146/2018/NĐ-CP (Hướng Dẫn Luật BHYT)';
  } else if (combinedSearch.includes('75/2023') || combinedSearch.includes('nd_75')) {
    resolvedPath = '/pdf/bhyt/Nghi_Dinh_75_2023_ND_CP_Sua_Doi_ND146_BHYT.pdf';
    resolvedTitle = 'Nghị định 75/2023/NĐ-CP (Sửa Đổi Nghị Định 146 BHYT)';
  } else if (combinedSearch.includes('188/2025') || combinedSearch.includes('nd_188')) {
    resolvedPath = '/pdf/bhyt/Nghi_Dinh_188_2025_ND_CP_Chi_Tiet_Luat_BHYT.pdf';
    resolvedTitle = 'Nghị định 188/2025/NĐ-CP (Quy Định Chi Tiết Luật BHYT)';
  } else if (combinedSearch.includes('20/2017') || combinedSearch.includes('kiem_soat_dac_biet') || combinedSearch.includes('morphin')) {
    resolvedPath = '/pdf/Thong_Tu_20_2017_TT_BYT_Thuoc_Kiem_Soat_Dac_Biet.pdf';
    resolvedTitle = 'Thông tư 20/2017/TT-BYT (Thuốc Kiểm Soát Đặc Biệt & Morphin)';
  } else if (combinedSearch.includes('5948') || combinedSearch.includes('tuong_tac')) {
    resolvedPath = '/pdf/Quyet_Dinh_5948_QD_BYT_Danh_Muc_Tuong_Tac_Chong_Chi_Dinh.pdf';
    resolvedTitle = 'Quyết định 5948/QĐ-BYT (Danh Mục Tương Tác Thuốc Chống Chỉ Định)';
  } else if (combinedSearch.includes('51/2017') || combinedSearch.includes('phan_ve')) {
    resolvedPath = '/pdf/Thong_Tu_51_2017_TT_BYT_Huong_Dan_Phong_Chan_Doan_Xu_Tri_Phan_Ve.pdf';
    resolvedTitle = 'Thông tư 51/2017/TT-BYT (Hướng Dẫn Xử Trí Phản Vệ Cấp Cứu)';
  } else if (combinedSearch.includes('26/2025') || combinedSearch.includes('ke_don')) {
    resolvedPath = '/pdf/Thong_Tu_26_2025_TT_BYT_Ke_Don_Thuoc.pdf';
    resolvedTitle = 'Thông tư 26/2025/TT-BYT (Quy Chế Kê Đơn Thuốc)';
  } else if (combinedSearch.includes('22/2011') || combinedSearch.includes('khoa_duoc')) {
    resolvedPath = '/pdf/Thong_Tu_22_2011_TT_BYT_Khoa_Duoc_Benh_Vien.pdf';
    resolvedTitle = 'Thông tư 22/2011/TT-BYT (Quy Chế Tổ Chức Khoa Dược Bệnh Viện)';
  } else if (combinedSearch.includes('23/2011') || combinedSearch.includes('su_dung_thuoc')) {
    resolvedPath = '/pdf/Thong_Tu_23_2011_TT_BYT_Huong_Dan_Su_Dung_Thuoc.pdf';
    resolvedTitle = 'Thông tư 23/2011/TT-BYT (Hướng Dẫn Sử Dụng Thuốc Nội Trú)';
  } else if (combinedSearch.includes('36/2018') || combinedSearch.includes('gsp') || combinedSearch.includes('chuoi_lanh')) {
    resolvedPath = '/pdf/Thong_Tu_36_2018_TT_BYT_GSP.pdf';
    resolvedTitle = 'Thông tư 36/2018/TT-BYT (Thực Hành Tốt Bảo Quản Thuốc GSP)';
  } else if (combinedSearch.includes('98/2021') || combinedSearch.includes('thiet_bi')) {
    resolvedPath = '/pdf/Nghi_Dinh_98_2021_ND_CP_Trang_Thiet_Bi_Y_Te.pdf';
    resolvedTitle = 'Nghị định 98/2021/NĐ-CP (Quản Lý Trang Thiết Bị Y Tế)';
  }

  // Đảm bảo số trang hợp lệ >= 1
  const safePage = Math.max(1, Math.floor(page));
  const exactHashUrl = resolvedPath ? `${resolvedPath}#page=${safePage}` : '';

  return {
    pdfUrl: resolvedPath,
    pageNumber: safePage,
    documentTitle: title || resolvedTitle,
    exactHashUrl
  };
}
