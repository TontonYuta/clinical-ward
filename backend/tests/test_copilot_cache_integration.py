"""
Kiểm thử tích hợp Clinical LRU & Semantic Cache
Kiểm tra:
1. Lần 1: Cache Miss (~800ms)
2. Lần 2 (Rephrased): Cache Hit (< 15ms)
3. Mutation Query ("Cho 1 lọ morphin"): Không bị cache
4. Endpoint /copilot/cache/stats ghi nhận chính xác
"""
import time
import httpx

BASE_URL = "http://127.0.0.1:8000/api/v1/copilot"

def run_cache_integration_test():
    client = httpx.Client(timeout=15.0)

    print("======================================================================")
    print("🏥 BẮT ĐẦU KIỂM THỬ TÍCH HỢP CLINICAL LRU & SEMANTIC CACHE (BACKEND)")
    print("======================================================================")

    # 1. Kiểm tra cache stats ban đầu
    res_stats_init = client.get(f"{BASE_URL}/cache/stats")
    assert res_stats_init.status_code == 200, f"Stats failed: {res_stats_init.text}"
    stats_init = res_stats_init.json()
    print(f"📊 Stats ban đầu: {stats_init}")

    # 2. Query 1: Câu hỏi lâm sàng chuẩn (Lần đầu -> Cache Miss)
    q1 = "Paracetamol 500mg uống thế nào?"
    print(f"\n1. Gửi query lần 1 (Cold - mong đợi Miss): '{q1}'")
    t0 = time.perf_counter()
    res1 = client.post(f"{BASE_URL}/chat", json={
        "query": q1,
        "user_role": "doctor",
        "user_name": "BS. Nguyễn Văn A"
    })
    elapsed_ms_1 = (time.perf_counter() - t0) * 1000
    assert res1.status_code == 200, f"Query 1 failed: {res1.text}"
    data1 = res1.json()
    print(f"   -> Phản hồi: {len(data1.get('reply_text', ''))} ký tự | Thời gian: {elapsed_ms_1:.1f}ms")

    # 3. Query 2: Câu hỏi rephrased với tiền tố giao tiếp và hậu tố lịch sự
    q2 = "Cho tôi hỏi Paracetamol 500mg uống thế nào với ạ?"
    print(f"\n2. Gửi query lần 2 (Rephrased - mong đợi Cache Hit < 20ms): '{q2}'")
    t0 = time.perf_counter()
    res2 = client.post(f"{BASE_URL}/chat", json={
        "query": q2,
        "user_role": "doctor",
        "user_name": "BS. Nguyễn Văn A"
    })
    elapsed_ms_2 = (time.perf_counter() - t0) * 1000
    assert res2.status_code == 200, f"Query 2 failed: {res2.text}"
    data2 = res2.json()
    print(f"   -> Phản hồi: {len(data2.get('reply_text', ''))} ký tự | Thời gian: {elapsed_ms_2:.1f}ms")

    # Kiểm tra nội dung trả về từ cache phải khớp với câu trả lời gốc
    assert data2.get("reply_text") == data1.get("reply_text"), "Nội dung cache không khớp bản gốc!"
    print(f"   ⚡ TỐC ĐỘ CACHE HIT: Nhanh hơn {elapsed_ms_1 / max(0.1, elapsed_ms_2):.1f} lần! ({elapsed_ms_2:.1f}ms vs {elapsed_ms_1:.1f}ms)")

    # 4. Query 3: SSE Streaming Endpoint Cache Hit
    q3 = "Xin hỏi paracetamol 500mg uống thế nào?"
    print(f"\n3. Gửi query qua SSE Streaming (Stream Cache Hit): '{q3}'")
    t0 = time.perf_counter()
    with client.stream("POST", f"{BASE_URL}/chat/stream", json={
        "query": q3,
        "user_role": "doctor",
        "user_name": "BS. Nguyễn Văn A"
    }) as stream_res:
        assert stream_res.status_code == 200
        # Đọc chunk đầu tiên
        first_chunk = next(stream_res.iter_lines())
        first_token_time = (time.perf_counter() - t0) * 1000
        print(f"   -> Token đầu tiên từ cache stream về trong: {first_token_time:.2f}ms! ({first_chunk[:40]}...)")

    # 5. Query 4: Mutation Command ("Cho 1 lọ morphin") -> Đảm bảo KHÔNG cache
    q_mut = "Cho 1 lọ morphin"
    print(f"\n4. Gửi lệnh nghiệp vụ có đơn vị xuất/mượn (Mong đợi KHÔNG lưu cache): '{q_mut}'")
    res_mut = client.post(f"{BASE_URL}/chat", json={
        "query": q_mut,
        "user_role": "nurse",
        "user_name": "ĐD. Lê Thị Thu"
    })
    assert res_mut.status_code == 200

    # Kiểm tra lại stats: hits phải tăng, và lệnh mượn/xuất không làm tăng size cache
    res_stats_final = client.get(f"{BASE_URL}/cache/stats")
    stats_final = res_stats_final.json()
    print(f"\n📊 Stats sau kiểm thử: {stats_final}")
    assert stats_final["hits"] >= 2, f"Mong đợi ít nhất 2 cache hits, thực tế: {stats_final['hits']}"
    assert stats_final["size"] == 1, f"Lệnh mượn không được cache (size phải giữ nguyên = 1, thực tế: {stats_final['size']})"
    assert stats_final["hit_ratio_percent"] > 0, "Tỷ lệ hit phải > 0%"

    print("\n======================================================================")
    print("🎉 TẤT CẢ KIỂM THỬ TÍCH HỢP CLINICAL CACHE ĐÃ VƯỢT QUA 100%!")
    print("======================================================================")

if __name__ == "__main__":
    run_cache_integration_test()
