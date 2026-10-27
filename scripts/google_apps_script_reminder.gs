/**
 * ==============================================================================
 * GOOGLE APPS SCRIPT: HỆ THỐNG GỬI EMAIL NHẮC NHỞ UỐNG THUỐC HÀNG NGÀY CHO BỆNH NHÂN
 * Phân hệ Dược Lâm Sàng & Bác Sĩ Kê Đơn - Tự động hóa qua Google Apps Script Web App
 * ==============================================================================
 *
 * HƯỚNG DẪN TRIỂN KHAI (DEPLOYMENT STEPS):
 * 1. Truy cập https://script.google.com và tạo một dự án mới (New Project).
 * 2. Đặt tên dự án: "ClinicalMedicationReminder".
 * 3. Dán toàn bộ nội dung mã nguồn tệp này vào tệp Code.gs.
 * 4. Nhấn nút "Deploy" (Triển khai) -> Chọn "New deployment" (Triển khai mới).
 * 5. Chọn loại: "Web app" (Ứng dụng web).
 *    - Description: "Webhook gửi email dặn dò uống thuốc"
 *    - Execute as (Thực thi dưới tên): "Me" (Tôi - tài khoản Gmail của bạn)
 *    - Who has access (Ai có quyền truy cập): "Anyone" (Bất kỳ ai)
 * 6. Nhấn "Deploy" -> Cấp quyền truy cập Gmail (Authorize Access).
 * 7. Sao chép "Web app URL" (VD: https://script.google.com/macros/s/AKfycbx.../exec)
 * 8. Dán URL này vào mục Cấu hình Google Script trong giao diện ứng dụng.
 * ==============================================================================
 */

function doGet(e) {
  var response = {
    status: "active",
    service: "Clinical Ward Medication Reminder Gateway",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    instructions: "Gửi yêu cầu HTTP POST với payload JSON chứa thông tin đơn thuốc và email bệnh nhân để tự động gửi thông báo."
  };
  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var output = {
    success: false,
    message: "",
    timestamp: new Date().toISOString()
  };

  try {
    if (!e || !e.postData || !e.postData.contents) {
      throw new Error("Không nhận được dữ liệu payload JSON (postData rỗng).");
    }

    var payload = JSON.parse(e.postData.contents);
    var advice = payload.advice || payload;

    var patientName = advice.patientName || "Quý bệnh nhân";
    var patientEmail = advice.patientEmail || "";
    var doctorName = advice.doctorName || "Bác sĩ điều trị";
    var diagnosis = advice.diagnosis || "Theo dõi điều trị ngoại trú";
    var hospitalName = advice.doctorHospital || "Bệnh Viện Đa Khoa Lâm Sàng";
    var generalAdvice = advice.generalDoctorAdvice || "Uống thuốc đúng giờ, tái khám khi hết đơn hoặc có dấu hiệu bất thường.";
    var medications = advice.medications || [];

    if (!patientEmail || patientEmail.indexOf("@") === -1) {
      throw new Error("Địa chỉ email của bệnh nhân không hợp lệ: " + patientEmail);
    }

    if (!medications || medications.length === 0) {
      throw new Error("Danh sách thuốc dặn dò không được để trống.");
    }

    var subject = "🏥 [LỊCH UỐNG THUỐC] Dặn dò của " + doctorName + " dành cho bệnh nhân " + patientName;
    var htmlBody = buildReminderEmailHtml(advice, patientName, doctorName, diagnosis, hospitalName, generalAdvice, medications);

    // Gửi email chính thức qua GmailApp
    GmailApp.sendEmail(patientEmail, subject, "", {
      htmlBody: htmlBody,
      name: hospitalName + " - " + doctorName
    });

    output.success = true;
    output.message = "Đã gửi email nhắc uống thuốc thành công đến bệnh nhân: " + patientEmail;
    output.emailSentTo = patientEmail;
    output.patientName = patientName;
  } catch (err) {
    output.success = false;
    output.message = "Lỗi khi xử lý gửi email: " + err.toString();
  }

  return ContentService.createTextOutput(JSON.stringify(output))
    .setMimeType(ContentService.MimeType.JSON);
}

function buildReminderEmailHtml(advice, patientName, doctorName, diagnosis, hospitalName, generalAdvice, medications) {
  var rowsHtml = "";
  for (var i = 0; i < medications.length; i++) {
    var med = medications[i];
    var slots = med.timeSlots || [];

    var morningStr = "—";
    var noonStr = "—";
    var afternoonStr = "—";
    var eveningStr = "—";

    for (var s = 0; s < slots.length; s++) {
      var slot = slots[s];
      var slotLabel = (slot.label || "").toLowerCase();
      var desc = "<strong style='font-size:13px;font-family:monospace;color:#0f172a;'>" + (slot.dosageText || "1 viên") + "</strong>" +
        (slot.mealRelation ? "<br/><span style='color:#64748b;font-size:10px;'>" + slot.mealRelation + "</span>" : "");
      if (slotLabel.indexOf("sáng") !== -1 || slot.id === "morning") morningStr = desc;
      else if (slotLabel.indexOf("trưa") !== -1 || slot.id === "noon") noonStr = desc;
      else if (slotLabel.indexOf("chiều") !== -1 || slot.id === "afternoon") afternoonStr = desc;
      else if (slotLabel.indexOf("tối") !== -1 || slot.id === "evening") eveningStr = desc;
    }

    rowsHtml += "<tr style='border-bottom:1px solid #cbd5e1;'>" +
      "<td style='padding:8px 10px;vertical-align:middle;border-right:1px solid #cbd5e1;'>" +
        "<strong style='color:#0f172a;font-size:13px;'>" + med.medicationName + "</strong>" +
        "<span style='color:#64748b;font-size:11px;display:block;'>" + (med.dosage || "") + (med.durationDays ? " • " + med.durationDays + " ngày" : "") + "</span>" +
      "</td>" +
      "<td style='padding:8px 6px;text-align:center;border-right:1px solid #cbd5e1;vertical-align:middle;'>" + morningStr + "</td>" +
      "<td style='padding:8px 6px;text-align:center;border-right:1px solid #cbd5e1;vertical-align:middle;'>" + noonStr + "</td>" +
      "<td style='padding:8px 6px;text-align:center;border-right:1px solid #cbd5e1;vertical-align:middle;'>" + afternoonStr + "</td>" +
      "<td style='padding:8px 6px;text-align:center;vertical-align:middle;'>" + eveningStr + "</td>" +
    "</tr>";
  }

  var adviceBlock = "";
  if (generalAdvice && generalAdvice.trim() !== "") {
    adviceBlock = "<div style='border:1px solid #cbd5e1;padding:10px 14px;border-radius:4px;margin-bottom:16px;background:#f8fafc;'>" +
      "<h4 style='margin:0 0 4px;color:#0f172a;font-size:12px;font-weight:bold;'>LỜI DẶN CỦA BÁC SĨ:</h4>" +
      "<p style='margin:0;font-size:12px;color:#334155;white-space:pre-line;line-height:1.4;'>" + generalAdvice + "</p>" +
    "</div>";
  }

  return "<div style='font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #000000;color:#0f172a;line-height:1.4;'>" +
    "<div style='border-bottom:2px solid #000000;padding:16px;text-align:center;background:#ffffff;'>" +
      "<h2 style='margin:0;font-size:17px;font-weight:bold;letter-spacing:0.5px;color:#000000;'>HƯỚNG DẪN DẶN DÒ UỐNG THUỐC HÀNG NGÀY</h2>" +
      "<p style='margin:4px 0 0;font-size:12px;color:#475569;'>" + hospitalName + " • BS kê đơn: <strong>" + doctorName + "</strong></p>" +
    "</div>" +
    "<div style='padding:16px;'>" +
      "<div style='border:1px solid #cbd5e1;padding:10px 14px;margin-bottom:14px;background:#f8fafc;border-radius:4px;font-size:12px;'>" +
        "<div style='margin-bottom:4px;'><strong>Bệnh nhân:</strong> <span style='font-size:13px;font-weight:bold;color:#000000;'>" + patientName + "</span> &nbsp;|&nbsp; <strong>Chẩn đoán:</strong> " + diagnosis + "</div>" +
        "<div><strong>Thời gian điều trị:</strong> " + (advice.startDate || "Hôm nay") + " đến " + (advice.endDate || "Khi hết thuốc") + "</div>" +
      "</div>" +
      "<table style='width:100%;border-collapse:collapse;font-size:12px;border:1px solid #000000;margin-bottom:14px;'>" +
        "<thead>" +
          "<tr style='background-color:#f1f5f9;border-bottom:1px solid #000000;color:#0f172a;text-align:center;font-weight:bold;'>" +
            "<th style='padding:8px 10px;text-align:left;border-right:1px solid #cbd5e1;'>Tên thuốc & Hàm lượng</th>" +
            "<th style='padding:8px 6px;width:18%;border-right:1px solid #cbd5e1;'>Sáng (07:00)</th>" +
            "<th style='padding:8px 6px;width:18%;border-right:1px solid #cbd5e1;'>Trưa (11:30)</th>" +
            "<th style='padding:8px 6px;width:18%;border-right:1px solid #cbd5e1;'>Chiều (18:00)</th>" +
            "<th style='padding:8px 6px;width:18%;'>Tối (20:00)</th>" +
          "</tr>" +
        "</thead>" +
        "<tbody>" + rowsHtml + "</tbody>" +
      "</table>" +
      adviceBlock +
    "</div>" +
    "<div style='background-color:#f8fafc;padding:10px 16px;text-align:center;font-size:11px;color:#64748b;border-top:1px solid #cbd5e1;'>" +
      "Hệ thống Quản Lý Đơn Thuốc Điện Tử CPOE & Dược Lâm Sàng • Chúc Quý bệnh nhân mau chóng bình phục!" +
    "</div>" +
  "</div>";
}
}
