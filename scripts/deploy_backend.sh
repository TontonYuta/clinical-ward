#!/usr/bin/env bash
# ==============================================================================
# Script tự động liên kết Backend đã deploy vào Vercel Frontend
# Sử dụng: ./scripts/deploy_backend.sh <URL_BACKEND>
# Ví dụ:   ./scripts/deploy_backend.sh https://clinical-ward-api.onrender.com
# ==============================================================================

set -e

BACKEND_URL="$1"

if [ -z "$BACKEND_URL" ]; then
  echo "❌ LỖI: Vui lòng cung cấp URL Backend của bạn!"
  echo "Cách dùng: ./scripts/deploy_backend.sh <URL_BACKEND>"
  echo "Ví dụ:     ./scripts/deploy_backend.sh https://clinical-ward-api.onrender.com"
  exit 1
fi

# Loại bỏ dấu / ở cuối nếu có
BACKEND_URL="${BACKEND_URL%/}"
API_BASE_URL="${BACKEND_URL}/api/v1"

echo "======================================================================"
echo "🏥 BẮT ĐẦU CẤU HÌNH LIÊN KẾT BACKEND CHO DỰ ÁN CLINICAL WARD"
echo "🌐 Backend Target : $BACKEND_URL"
echo "⚡ API Endpoint   : $API_BASE_URL"
echo "======================================================================"

echo ""
echo "🔍 [1/3] Kiểm tra độ sẵn sàng của máy chủ Backend..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BACKEND_URL/docs" || echo "000")

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "301" ] || [ "$HTTP_CODE" = "302" ]; then
  echo "✅ Máy chủ phản hồi hợp lệ (HTTP $HTTP_CODE)."
else
  echo "⚠️ CẢNH BÁO: Máy chủ trả về mã HTTP $HTTP_CODE (có thể máy chủ đang khởi động hoặc chưa cấp xong SSL)."
  echo "Vẫn tiếp tục cấu hình biến môi trường lên Vercel..."
fi

echo ""
echo "🚀 [2/3] Cập nhật biến môi trường VITE_API_BASE_URL lên Vercel..."
# Cập nhật cho production, preview và development
npx vercel env rm VITE_API_BASE_URL production -y || true
npx vercel env rm VITE_API_BASE_URL preview -y || true
npx vercel env rm VITE_API_BASE_URL development -y || true

npx vercel env add VITE_API_BASE_URL production --value "$API_BASE_URL" --yes --force
npx vercel env add VITE_API_BASE_URL preview --value "$API_BASE_URL" --yes --force
npx vercel env add VITE_API_BASE_URL development --value "$API_BASE_URL" --yes --force

echo "✅ Đã gán VITE_API_BASE_URL = $API_BASE_URL thành công trên Vercel."

echo ""
echo "📦 [3/3] Kích hoạt Vercel Production Build với Backend mới..."
npx vercel --prod --yes

echo ""
echo "======================================================================"
echo "🎉 HOÀN TẤT THIẾT LẬP 100%!"
echo "Frontend Production : https://clinical-ward.vercel.app"
echo "Backend Production  : $BACKEND_URL"
echo "======================================================================"
