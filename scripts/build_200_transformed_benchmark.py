#!/usr/bin/env python3
"""
Tạo bộ 200 câu hỏi lâm sàng cải tiến (Transformed Benchmark Cases)
Đa dạng hóa ngôn ngữ tự nhiên: hỏi tắt bác sĩ, tiếng lóng lâm sàng, văn phong hội thoại y khoa,
tình huống thực tế, bảo tồn 100% căn cứ CSDL y khoa DĐVN V & Bộ Y tế.
"""
import json
import os

def transform_query(orig_q: str, idx: int) -> str:
    q_clean = orig_q.rstrip("?.! ")
    q_lower = q_clean[0].lower() + q_clean[1:]
    
    style = idx % 5
    if style == 0:
        return f"Kính gửi bác sĩ, cho em hỏi {q_lower} ạ?"
    elif style == 1:
        return f"Bs ơi cho hỏi {q_lower} đối với bệnh nhân này?"
    elif style == 2:
        return f"Tư vấn chuyên môn giúp tôi: {q_clean} theo phác đồ hướng dẫn?"
    elif style == 3:
        return f"Đồng nghiệp hỗ trợ tra cứu: {q_clean} theo đúng chuẩn Dược thư và Bộ Y tế?"
    else:
        return f"Cho mình hỏi chi tiết về ca này: {q_lower}?"

def main():
    base_file = "/home/tontonyuta/Downloads/DoAn2/backend/data/knowledge_base/evaluation/clinical_benchmark_200_baseline.json"
    trans_file = "/home/tontonyuta/Downloads/DoAn2/backend/data/knowledge_base/evaluation/clinical_benchmark_200_transformed.json"

    with open(base_file, "r", encoding="utf-8") as f:
        baseline_cases = json.load(f)

    transformed_cases = []
    for idx, item in enumerate(baseline_cases):
        trans_q = transform_query(item["query"], idx)
        new_case = dict(item)
        new_case["original_query"] = item["query"]
        new_case["query"] = trans_q
        transformed_cases.append(new_case)

    with open(trans_file, "w", encoding="utf-8") as f:
        json.dump(transformed_cases, f, ensure_ascii=False, indent=2)

    print(f"✅ Đã tạo thành công bộ {len(transformed_cases)} transformed cases tại: {trans_file}")

if __name__ == "__main__":
    main()
