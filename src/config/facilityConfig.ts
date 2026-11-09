/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Centralized Healthcare Facility & Clinical Operations Configuration
 */

export const FACILITY_CONFIG = {
  // Healthcare Facility Profile
  HOSPITAL_NAME: 'Bệnh Viện Đa Khoa Lâm Sàng',
  HOSPITAL_SHORT_NAME: 'BV ĐA KHOA LÂM SÀNG',
  SMS_BRANDNAME: 'BV_LAMSANG',
  SMS_HEADER_TAG: '[BV LAM SANG]',
  FACILITY_CODE: '79001',
  HOTLINE: '1900-1234',
  PORTAL_URL: 'https://donthuocquocgia.vn',

  // Clinical Defaults
  DEFAULT_DOCTOR_NAME: 'BS. Trần Văn Hùng',
  DEFAULT_DOCTOR_CERTIFICATE: '009125/BYT-CCHN',
  DEFAULT_DEPARTMENT: 'Khoa Cấp Cứu A9',

  // Pharmacy Defaults
  DEFAULT_PHARMACIST_NAME: 'DS. Nguyễn Bích Ngọc',
  DEFAULT_DISPATCHER_TITLE: 'Dược sĩ trực kho',
} as const;
