#!/usr/bin/env python3
"""
Evaluation Runner for 200 Clinical Benchmark Cases.
Measures Content Quality, Suggested Chips Quality, and Trustworthiness/Grounding.
"""
import sys
import json
import asyncio
from pathlib import Path
from httpx import AsyncClient

GENERIC_CHIPS = {
    "tra cứu thông tin thuốc", "kiểm tra tương tác hai thuốc", "tra cứu dược thư quốc gia",
    "kiểm tra đơn thuốc", "mở form gửi email/sms", "thuốc cận hạn fefo",
    "kiểm tra đơn thuốc theo tt 26", "tương tác giữa clopidogrel và omeprazol"
}

def evaluate_case_response(case: dict, response_data: dict) -> dict:
    reply = response_data.get("reply_text", "")
    reply_lower = reply.lower()
    intent = response_data.get("intent", "")
    chips = response_data.get("suggested_chips") or []
    legal = response_data.get("legal_basis") or ""
    citations = response_data.get("citations") or []
    
    # 1. CONTENT QUALITY SCORE (0 - 100)
    # Check expected entities presence
    entities = case.get("expected_entities", [])
    found_entities = [e for e in entities if e.lower() in reply_lower]
    entity_ratio = len(found_entities) / max(len(entities), 1)
    
    # Check key facts recall
    key_facts = case.get("key_facts", [])
    found_facts = 0
    for fact in key_facts:
        # Check if at least 2 significant words from fact appear in reply
        fact_words = [w for w in fact.lower().replace(",", " ").replace(".", " ").replace("(", " ").replace(")", " ").split() if len(w) >= 3]
        if sum(1 for w in fact_words if w in reply_lower) >= max(2, len(fact_words) // 2):
            found_facts += 1
    fact_ratio = found_facts / max(len(key_facts), 1)
    
    # Check if answer is too generic or repetitive
    is_directory_dump = "hệ thống trợ lý dược lâm sàng & quy trình bệnh viện" in reply_lower
    has_details_tag = "<details>" in reply_lower or "<summary>" in reply_lower
    
    base_content = 50.0 * entity_ratio + 50.0 * fact_ratio
    if is_directory_dump:
        base_content = min(base_content, 35.0)
    content_score = round(max(0.0, min(100.0, base_content)), 1)
    
    # 2. SUGGESTED CHIPS QUALITY SCORE (0 - 100)
    if not chips:
        chips_score = 0.0
    else:
        # Check how many chips are context-specific vs generic boilerplate
        specific_count = sum(1 for c in chips if c.lower().strip() not in GENERIC_CHIPS and len(c.strip()) >= 5)
        spec_ratio = specific_count / len(chips)
        chips_score = round(max(0.0, min(100.0, 40.0 * min(len(chips) / 3.0, 1.0) + 60.0 * spec_ratio)), 1)
    
    # 3. TRUSTWORTHINESS & GROUNDING SCORE (0 - 100)
    # Check legal basis citation
    has_legal = bool(legal and len(legal.strip()) >= 5)
    has_citations = len(citations) > 0
    has_formal_source = any(src in reply_lower for src in ["dược thư", "bộ y tế", "dav", "thông tư", "quyết định", "dđvn", "csdl"])
    
    trust_base = 0.0
    if has_legal:
        trust_base += 40.0
    if has_citations:
        trust_base += 30.0
    if has_formal_source:
        trust_base += 30.0
    
    # If the response hallucinated or lacked grounding completely
    if not has_legal and not has_citations and not has_formal_source:
        trust_base = 20.0
    trust_score = round(max(0.0, min(100.0, trust_base)), 1)
    
    # COMPOSITE SCORE
    composite = round(0.40 * content_score + 0.30 * chips_score + 0.30 * trust_score, 1)
    
    return {
        "id": case["id"],
        "category": case["category"],
        "query": case["query"],
        "intent": intent,
        "content_score": content_score,
        "chips_score": chips_score,
        "trust_score": trust_score,
        "composite_score": composite,
        "entity_ratio": round(entity_ratio, 2),
        "fact_ratio": round(fact_ratio, 2),
        "chips_count": len(chips),
        "is_directory_dump": is_directory_dump,
        "has_details_tag": has_details_tag,
        "reply_preview": reply[:160] + "..." if len(reply) > 160 else reply
    }

async def run_benchmark(cases_path: str, output_path: str):
    with open(cases_path, "r", encoding="utf-8") as f:
        cases = json.load(f)
    
    results = []
    print(f"🚀 Running evaluation on {len(cases)} cases from {cases_path}...")
    
    async with AsyncClient(base_url="http://127.0.0.1:8000", timeout=30.0) as client:
        for idx, case in enumerate(cases, 1):
            session_id = f"bench_eval_{case['id']}"
            payload = {
                "query": case["query"],
                "user_name": "BS. Đánh Giá Lâm Sàng",
                "user_role": "doctor",
                "session_id": session_id
            }
            try:
                res = await client.post("/api/v1/copilot/chat", json=payload)
                if res.status_code == 200:
                    resp_data = res.json()
                else:
                    resp_data = {"reply_text": f"HTTP Error {res.status_code}", "intent": "HTTP_ERROR"}
            except Exception as e:
                resp_data = {"reply_text": f"Exception {e}", "intent": "CLIENT_EXCEPTION"}
            
            evaluated = evaluate_case_response(case, resp_data)
            results.append(evaluated)
            if idx % 25 == 0 or idx == len(cases):
                print(f"  Processed {idx}/{len(cases)} cases... Current Avg Composite: {sum(r['composite_score'] for r in results)/len(results):.1f}")
    
    # Compute aggregate stats
    avg_content = sum(r["content_score"] for r in results) / len(results)
    avg_chips = sum(r["chips_score"] for r in results) / len(results)
    avg_trust = sum(r["trust_score"] for r in results) / len(results)
    avg_comp = sum(r["composite_score"] for r in results) / len(results)
    
    summary = {
        "total_cases": len(results),
        "avg_content_score": round(avg_content, 2),
        "avg_chips_score": round(avg_chips, 2),
        "avg_trust_score": round(avg_trust, 2),
        "avg_composite_score": round(avg_comp, 2),
        "directory_dump_count": sum(1 for r in results if r["is_directory_dump"]),
        "has_details_tag_count": sum(1 for r in results if r["has_details_tag"]),
        "results": results
    }
    
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)
    
    print("\n" + "="*60)
    print("📊 BENCHMARK EVALUATION SUMMARY")
    print("="*60)
    print(f"• Total Evaluated Cases:       {len(results)}")
    print(f"• Content Quality Score:       {avg_content:.2f} / 100")
    print(f"• Suggested Chips Score:       {avg_chips:.2f} / 100")
    print(f"• Trustworthiness Score:       {avg_trust:.2f} / 100")
    print(f"• 🌟 COMPOSITE BENCHMARK SCORE: {avg_comp:.2f} / 100")
    print(f"• Directory Dump Fallbacks:    {summary['directory_dump_count']} cases")
    print(f"• Rigid <details> Tags:        {summary['has_details_tag_count']} cases")
    print("="*60)

if __name__ == "__main__":
    cases_file = sys.argv[1] if len(sys.argv) > 1 else "/home/tontonyuta/Downloads/DoAn2/backend/data/knowledge_base/evaluation/clinical_benchmark_200_baseline.json"
    output_file = sys.argv[2] if len(sys.argv) > 2 else "/home/tontonyuta/Downloads/DoAn2/backend/data/knowledge_base/evaluation/benchmark_200_baseline_results.json"
    asyncio.run(run_benchmark(cases_file, output_file))
