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
    var doctorName = advice.doctorName || "Chưa ghi";
    var diagnosis = advice.diagnosis || "Chưa ghi";
    var hospitalName = advice.doctorHospital || "Chưa ghi cơ sở";
    var generalAdvice = advice.generalDoctorAdvice || "";
    var medications = advice.medications || [];

    if (!patientEmail || patientEmail.indexOf("@") === -1) {
      throw new Error("Địa chỉ email của bệnh nhân không hợp lệ: " + patientEmail);
    }

    if (!medications || medications.length === 0) {
      throw new Error("Danh sách thuốc dặn dò không được để trống.");
    }

    var subject = "Thông tin dùng thuốc - " + patientName;
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

function escapeReminderHtml(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, function(character) {
    return {"&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"}[character];
  });
}

function buildReminderEmailHtml(advice, patientName, doctorName, diagnosis, hospitalName, generalAdvice, medications) {
  var escape = escapeReminderHtml;
  var rows = medications.map(function(med) {
    var slots = med.timeSlots || [];
    var schedule = slots.length ? slots.map(function(slot) {
      return escape(slot.label || "Chưa ghi buổi") + ": " + escape(slot.time || "Chưa ghi giờ") + " · " + escape(slot.dosageText || "Chưa ghi liều") + " · " + escape(slot.mealRelation || "Chưa ghi liên hệ bữa ăn") + (slot.note ? " · " + escape(slot.note) : "");
    }).join("<br/>") : "Chưa cấu hình giờ dùng; xem chỉ định đã kê.";
    return "<tr><td>" + escape(med.medicationName) + "</td><td>Liều: " + escape(med.dosage || "Chưa ghi") +
      "<br/>Đường dùng: " + escape(med.route || "Chưa ghi") + "<br/>Tần suất: " + escape(med.frequency || "Chưa ghi") +
      "<br/>Thời hạn: " + (med.durationDays > 0 ? escape(med.durationDays) + " ngày" : "Chưa ghi") +
      (med.specialInstructions ? "<br/>Chỉ dẫn: " + escape(med.specialInstructions) : "") + "</td><td>" + schedule + "</td></tr>";
  }).join("");
  return "<div style='font-family:Arial,sans-serif;max-width:720px;margin:auto;color:#0f172a;line-height:1.5'>" +
    "<h2>Thông tin dùng thuốc</h2><p>Cơ sở trên nguồn: " + escape(hospitalName) + "<br/>Người kê trên nguồn: " + escape(doctorName) + "</p>" +
    "<p>Người bệnh: " + escape(patientName) + "<br/>Chẩn đoán: " + escape(diagnosis) +
    "<br/>Mã nguồn: " + escape(advice.prescriptionId || advice.id || "Chưa ghi") +
    "<br/>Khoảng thời gian đã xác nhận: " + escape(advice.startDate || "Chưa ghi") + " đến " + escape(advice.endDate || "Chưa ghi") + "</p>" +
    "<table border='1' cellpadding='8' style='width:100%;border-collapse:collapse'><thead><tr><th>Thuốc</th><th>Chỉ định nguồn</th><th>Giờ dùng được cung cấp</th></tr></thead><tbody>" + rows + "</tbody></table>" +
    (generalAdvice ? "<p style='white-space:pre-line'>Lời dặn: " + escape(generalAdvice) + "</p>" : "") + "</div>";
}
