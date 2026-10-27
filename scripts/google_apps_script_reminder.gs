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
      var desc = "<strong>" + (slot.dosageText || "1 viên") + "</strong> (" + (slot.time || "") + ")<br/><span style='color:#0f766e;font-size:11px;'>" + (slot.mealRelation || "") + "</span>";
      if (slotLabel.indexOf("sáng") !== -1 || slot.id === "morning") morningStr = desc;
      else if (slotLabel.indexOf("trưa") !== -1 || slot.id === "noon") noonStr = desc;
      else if (slotLabel.indexOf("chiều") !== -1 || slot.id === "afternoon") afternoonStr = desc;
      else if (slotLabel.indexOf("tối") !== -1 || slot.id === "evening") eveningStr = desc;
    }

    rowsHtml += "<tr style='border-bottom:1px solid #e2e8f0;'>" +
      "<td style='padding:10px 12px;vertical-align:top;'>" +
        "<strong style='color:#0f172a;font-size:14px;'>" + med.medicationName + "</strong>" +
        (med.activeIngredient ? "<br/><span style='color:#64748b;font-size:11px;'>Hoạt chất: " + med.activeIngredient + "</span>" : "") +
        (med.specialInstructions ? "<br/><span style='color:#b91c1c;font-size:11px;font-style:italic;'>Lưu ý: " + med.specialInstructions + "</span>" : "") +
      "</td>" +
      "<td style='padding:10px 8px;text-align:center;background-color:#f0fdfa;vertical-align:top;'>" + morningStr + "</td>" +
      "<td style='padding:10px 8px;text-align:center;background-color:#fefce8;vertical-align:top;'>" + noonStr + "</td>" +
      "<td style='padding:10px 8px;text-align:center;background-color:#fff7ed;vertical-align:top;'>" + afternoonStr + "</td>" +
      "<td style='padding:10px 8px;text-align:center;background-color:#f8fafc;vertical-align:top;'>" + eveningStr + "</td>" +
    "</tr>";
  }

  return "<div style='font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #cbd5e1;border-radius:10px;overflow:hidden;color:#1e293b;line-height:1.5;'>" +
    "<div style='background-color:#0f766e;color:#ffffff;padding:20px;text-align:center;'>" +
      "<h1 style='margin:0;font-size:20px;letter-spacing:0.5px;'>HƯỚNG DẪN DẶN DÒ UỐNG THUỐC HÀNG NGÀY</h1>" +
      "<p style='margin:6px 0 0;font-size:13px;opacity:0.95;'>" + hospitalName + " • Bác sĩ kê đơn: " + doctorName + "</p>" +
    "</div>" +
    "<div style='padding:20px;'>" +
      "<div style='background-color:#f8fafc;border-left:4px solid #0f766e;padding:12px 16px;margin-bottom:20px;border-radius:0 8px 8px 0;'>" +
        "<p style='margin:0 0 6px;'><strong>Họ và tên bệnh nhân:</strong> <span style='color:#0f766e;font-size:15px;font-weight:bold;'>" + patientName + "</span></p>" +
        "<p style='margin:0 0 6px;'><strong>Chẩn đoán điều trị:</strong> " + diagnosis + "</p>" +
        "<p style='margin:0;'><strong>Thời gian áp dụng đơn thuốc:</strong> " + (advice.startDate || "Hôm nay") + " đến " + (advice.endDate || "Khi hết thuốc") + "</p>" +
      "</div>" +
      "<h3 style='margin:0 0 10px;color:#0f766e;font-size:15px;text-transform:uppercase;'>📅 Lịch phân chia cữ uống thuốc trong ngày:</h3>" +
      "<table style='width:100%;border-collapse:collapse;font-size:13px;border:1px solid #cbd5e1;border-radius:8px;overflow:hidden;margin-bottom:20px;'>" +
        "<thead>" +
          "<tr style='background-color:#0f766e;color:#ffffff;text-align:center;'>" +
            "<th style='padding:10px 12px;text-align:left;'>Tên thuốc & Hàm lượng</th>" +
            "<th style='padding:10px 8px;width:20%;'>🌅 Sáng<br/><span style='font-size:11px;font-weight:normal;'>07:00</span></th>" +
            "<th style='padding:10px 8px;width:20%;'>☀️ Trưa<br/><span style='font-size:11px;font-weight:normal;'>11:30</span></th>" +
            "<th style='padding:10px 8px;width:20%;'>🌤️ Chiều<br/><span style='font-size:11px;font-weight:normal;'>18:00</span></th>" +
            "<th style='padding:10px 8px;width:20%;'>🌙 Tối<br/><span style='font-size:11px;font-weight:normal;'>21:00</span></th>" +
          "</tr>" +
        "</thead>" +
        "<tbody>" + rowsHtml + "</tbody>" +
      "</table>" +
      "<div style='background-color:#eff6ff;border:1px solid #bfdbfe;padding:14px 16px;border-radius:8px;margin-bottom:20px;'>" +
        "<h4 style='margin:0 0 6px;color:#1e40af;font-size:14px;'>💡 Lời dặn dò của bác sĩ:</h4>" +
        "<p style='margin:0;font-size:13px;color:#1e3a8a;white-space:pre-line;'>" + generalAdvice + "</p>" +
      "</div>" +
      "<div style='background-color:#fef2f2;border:1px solid #fecaca;padding:12px 16px;border-radius:8px;margin-bottom:20px;font-size:12px;color:#991b1b;'>" +
        "<strong>⚠️ Lưu ý khẩn cấp:</strong> Nếu gặp bất kỳ phản ứng dị ứng nào như nổi mẩn ngứa, khó thở, tức ngực, hoặc chóng mặt dữ dội, hãy ngưng thuốc ngay lập tức và liên hệ cơ sở y tế gần nhất hoặc gọi cấp cứu 115." +
      "</div>" +
    "</div>" +
    "<div style='background-color:#f1f5f9;padding:14px 20px;text-align:center;font-size:11px;color:#64748b;border-top:1px solid #e2e8f0;'>" +
      "Email này được tạo tự động từ Hệ thống Quản Lý Dược Lâm Sàng & Đơn Thuốc Điện Tử CPOE.<br/>Chúc Quý bệnh nhân mau chóng bình phục sức khỏe!" +
    "</div>" +
  "</div>";
}
