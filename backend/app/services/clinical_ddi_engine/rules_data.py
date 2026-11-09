"""
Clinical Interaction Rules & Safe Synergies (<=195 LOC)
Nguồn: QĐ 5948/QĐ-BYT (Mục 3.1 & 3.2), Dược thư Quốc gia Việt Nam lần xuất bản II (2015)
"""

CLASS_DDI_RULES: list[dict] = [
    {
        "id": "RULE_NITRATE_PDE5", "class_a": "NITRATE", "class_b": "PDE5_INHIBITOR",
        "severity": "CONTRAINDICATED", "title": "DẪN CHẤT NITRAT + ỨC CHẾ PDE-5: TỤT HUYẾT ÁP TRỤY MẠCH TỬ VONG",
        "mech": "Hiệp đồng tăng nồng độ cGMP nội bào tại cơ trơn mạch máu gây giãn mạch toàn thân dữ dội.",
        "conseq": "Tụt huyết áp kịch phát, nhồi máu cơ tim cấp, ngừng tim tử vong.",
        "action": "Chống chỉ định tuyệt đối phối hợp. Cách ly tối thiểu 24-48 giờ.", "source": "QĐ 5948/QĐ-BYT (Mục 3.2)"
    },
    {
        "id": "RULE_CEFTRIAXONE_CALCIUM", "class_a": "CEFTRIAXONE", "class_b": "CALCIUM_CARRIER",
        "severity": "CONTRAINDICATED", "title": "CEFTRIAXONE + DỊCH TRUYỀN CHỨA CALCI: TỦ TẠO MUỐI TẮC MẠCH",
        "mech": "Tạo muối Ceftriaxon-Calci kết tủa dạng vi tinh thể không tan trong máu.",
        "conseq": "Tắc vi mạch phổi, suy thận cấp, ngừng tim tử vong (đặc biệt trẻ sơ sinh <= 28 ngày).",
        "action": "CẤM pha chung hoặc truyền cùng đường truyền tĩnh mạch trong vòng 48 giờ.", "source": "QĐ 5948/QĐ-BYT & SmPC Bộ Y Tế"
    },
    {
        "id": "RULE_STATIN_CYP3A4", "class_a": "STATIN_CYP3A4", "class_b": "MACROLIDE_CYP3A4",
        "severity": "CONTRAINDICATED", "title": "STATIN + KHÁNG SINH MACROLID: TIÊU CƠ VÂN CẤP TỬ VONG",
        "mech": "Macrolid ức chế mạnh CYP3A4 làm tăng nồng độ Statin huyết tương gấp 5-10 lần.",
        "conseq": "Tiêu cơ vân cấp (Rhabdomyolysis), myoglobin niệu gây suy thận cấp vô niệu.",
        "action": "Chống chỉ định phối hợp. Tạm ngừng Statin trong suốt đợt điều trị kháng sinh.", "source": "QĐ 5948/QĐ-BYT (Mục 3.2)"
    },
    {
        "id": "RULE_CARBAMAZEPINE_MACROLIDE", "class_a": "ANTIEPILEPTIC", "class_b": "MACROLIDE_CYP3A4",
        "severity": "CONTRAINDICATED", "title": "KHÁNG ĐỘNG KINH (CARBAMAZEPIN) + MACROLID: TĂNG VỌT NỒNG ĐỘ & NGỘ ĐỘC THẦN KINH",
        "mech": "Kháng sinh Macrolid (Clarithromycin, Erythromycin) ức chế mạnh CYP3A4, làm giảm chuyển hóa Carbamazepin dẫn đến tăng vọt nồng độ thuốc trong huyết tương.",
        "conseq": "Ngộ độc cấp Carbamazepin: chóng mặt, mất điều hòa vận động, ngủ gà, nhìn đôi, rung giật nhãn cầu, ức chế hô hấp và co giật.",
        "action": "Chống chỉ định phối hợp hoặc tránh sử dụng đồng thời. Nếu cần kháng sinh, chuyển sang Azithromycin hoặc nhóm Betalactam.", "source": "Dược Thư Quốc Gia Việt Nam & QĐ 5948/QĐ-BYT"
    },
    {
        "id": "RULE_STATIN_AZOLE", "class_a": "STATIN_CYP3A4", "class_b": "AZOLE_CYP",
        "severity": "CONTRAINDICATED", "title": "STATIN + KHÁNG NẤM AZOLE: NGUY CƠ TIÊU CƠ VÂN CẤP",
        "mech": "Kháng nấm Azole ức chế chuyển hóa Statin qua CYP3A4.",
        "conseq": "Tăng nồng độ Statin dẫn đến tiêu cơ vân và tổn thương thận cấp tính.",
        "action": "Chống chỉ định phối hợp. Tạm ngừng Statin.", "source": "QĐ 5948/QĐ-BYT (Mục 3.2)"
    },
    {
        "id": "RULE_CLOPIDOGREL_PPI", "class_a": "P2Y12_INHIBITOR", "class_b": "PPI_CYP2C19",
        "severity": "CONTRAINDICATED", "title": "CLOPIDOGREL + OMEPRAZOL/ESOMEPRAZOL: GIẢM HIỆU LỰC CHỐNG ĐÔNG",
        "mech": "Omeprazol/Esomeprazol ức chế CYP2C19 ngăn hoạt hóa tiền chất Clopidogrel.",
        "conseq": "Mất hiệu lực bảo vệ tim mạch, tăng nguy cơ huyết khối stent và tái phát nhồi máu cơ tim.",
        "action": "Đổi sang PPI ít ức chế CYP2C19 như Pantoprazol hoặc Rabeprazol.", "source": "QĐ 5948/QĐ-BYT (Mục 3.2)"
    },
    {
        "id": "RULE_DUAL_NSAID", "class_a": "NSAID", "class_b": "NSAID",
        "severity": "CONTRAINDICATED", "title": "PHỐI HỢP HAI HOẶC NHIỀU NSAID: NGUY CƠ XUẤT HUYẾT TIÊU HÓA Ồ ẠT",
        "mech": "Hiệp đồng ức chế COX-1 bảo vệ niêm mạc dạ dày và chức năng tiểu cầu.",
        "conseq": "Loét thủng dạ dày - tá tràng, xuất huyết tiêu hóa ồ ạt đe dọa tính mạng.",
        "action": "Chống chỉ định phối hợp đồng thời 2 NSAID. Chỉ dùng 1 loại ở liều thấp nhất hiệu quả.", "source": "QĐ 5948/QĐ-BYT (Mục 3.2)"
    },
    {
        "id": "RULE_WARFARIN_NSAID", "class_a": "VITAMIN_K_ANTAGONIST", "class_b": "NSAID",
        "severity": "CONTRAINDICATED", "title": "KHÁNG VITAMIN K (WARFARIN) + NSAID / ASPIRIN: XUẤT HUYẾT TIÊU HÓA Ồ ẠT",
        "mech": "Hiệp đồng tác dụng chống đông máu và ức chế ngưng tập tiểu cầu, kết hợp tổn thương bào mòn niêm mạc dạ dày tá tràng của NSAID.",
        "conseq": "Nguy cơ xuất huyết tiêu hóa ồ ạt, loét thủng dạ dày, chảy máu kéo dài đe dọa tính mạng.",
        "action": "Chống chỉ định phối hợp thường quy. Nếu bắt buộc chỉ định tim mạch (van cơ học), giám sát chặt INR và dùng kèm PPI bảo vệ dạ dày.", "source": "QĐ 5948/QĐ-BYT (Mục 3.2) & Dược Thư Quốc Gia Việt Nam"
    },
    {
        "id": "RULE_NSAID_METHOTREXATE", "class_a": "NSAID", "class_b": "ANTIMETABOLITE",
        "severity": "CONTRAINDICATED", "title": "NSAID + METHOTREXAT: TÍCH LŨY ĐỘC TÍNH TỦY XƯƠNG CẤP",
        "mech": "NSAID giảm bài tiết Methotrexat qua ống thận và giảm lưu lượng máu thận.",
        "conseq": "Ngộ độc Methotrexat đe dọa tính mạng: suy tủy xương, mất bạch cầu hạt, loét trợt tiêu hóa.",
        "action": "Chống chỉ định dùng NSAID chung với Methotrexat liều cao (>= 15mg/tuần).", "source": "QĐ 5948/QĐ-BYT (Mục 3.2)"
    },
    {
        "id": "RULE_OPIOID_BENZO", "class_a": "OPIOID", "class_b": "BENZODIAZEPINE",
        "severity": "CONTRAINDICATED", "title": "OPIOID + BENZODIAZEPINE: ỨC CHẾ HÔ HẤP HÔN MÊ TỬ VONG",
        "mech": "Hiệp đồng tác dụng an thần sâu trên thụ thể mu-opioid và GABA-A tại hành tủy não.",
        "conseq": "Ức chế trung tâm hô hấp không hồi phục, ngừng thở đột ngột, hôn mê tử vong.",
        "action": "Chống chỉ định phối hợp thường quy. Nếu bắt buộc, theo dõi SpO2 liên tục, sẵn sàng Naloxone.", "source": "FDA Boxed Warning; cần đối chiếu tờ hướng dẫn/SmPC hiện hành"
    },
    {
        "id": "RULE_SEROTONIN_SYNDROME", "class_a": "SEROTONERGIC", "class_b": "MAOI",
        "severity": "CONTRAINDICATED", "title": "TRAMADOL + LINEZOLID/MAOI: HỘI CHỨNG SEROTONIN ÁC TÍNH",
        "mech": "Hiệp đồng ức chế tái hấp thu và ngăn phân hủy Serotonin ở synap thần kinh.",
        "conseq": "Hội chứng Serotonin ác tính: sốt cao ác tính, co giật, rung giật cơ, trụy tim mạch tử vong.",
        "action": "Chống chỉ định tuyệt đối phối hợp. Cách ly tối thiểu 14 ngày sau khi ngừng MAOI.", "source": "QĐ 5948/QĐ-BYT & SmPC Tramadol"
    },
    {
        "id": "RULE_QUINOLONE_THEO", "class_a": "FLUOROQUINOLONE", "class_b": "THEOPHYLLINE",
        "severity": "MAJOR", "title": "CIPROFLOXACIN + THEOPHYLLIN: NGỘ ĐỘC THEOPHYLLIN CO GIẬT",
        "mech": "Ciprofloxacin ức chế mạnh isoenzym CYP1A2 tại gan làm giảm chuyển hóa Theophyllin.",
        "conseq": "Tích lũy nồng độ Theophyllin gây loạn nhịp thất kịch phát và co giật toàn thể kháng trị.",
        "action": "Tránh phối hợp. Nếu bắt buộc, giảm 50% liều Theophyllin và theo dõi TDM nồng độ máu.", "source": "QĐ 5948/QĐ-BYT (Mục 3.2)"
    },
    {
        "id": "RULE_QUINOLONE_ANTACID", "class_a": "FLUOROQUINOLONE", "class_b": "MULTIVALENT_CATION",
        "severity": "MODERATE", "title": "QUINOLON + ANTACID / KIM LOẠI ĐA HÓA TRỊ: GIẢM HẤP THU KHÁNG SINH",
        "mech": "Tạo phức chelate không tan với cation Mg2+, Al3+, Fe2+, Ca2+ trong đường ruột.",
        "conseq": "Giảm 50-90% sinh khả dụng kháng sinh, dẫn đến thất bại điều trị nhiễm khuẩn.",
        "action": "Uống kháng sinh ít nhất 2 giờ trước hoặc 4 giờ sau khi uống Antacid.", "source": "QĐ 5948/QĐ-BYT (Mục 3.2)"
    },
    {
        "id": "RULE_AMIODARONE_COLCHICINE", "class_a": "ANTIARRHYTHMIC_III", "class_b": "COLCHICINE",
        "severity": "MAJOR", "title": "AMIODARON + COLCHICIN: TÍCH LŨY ĐỘC TÍNH COLCHICIN ĐA CƠ QUAN",
        "mech": "Amiodaron ức chế bơm tống P-glycoprotein làm giảm thải trừ Colchicin qua ruột và thận.",
        "conseq": "Ngộ độc Colchicin cấp: tiêu cơ vân, suy tủy, suy đa tạng tử vong (Đặc biệt suy gan/thận).",
        "action": "Theo dõi sát dấu hiệu ngộ độc Colchicin. Chống chỉ định nếu bệnh nhân suy thận hoặc suy gan.", "source": "QĐ 5948/QĐ-BYT (Mục 3.2)"
    },
    {
        "id": "RULE_AMIODARONE_DIGOXIN", "class_a": "ANTIARRHYTHMIC_III", "class_b": "DIGITALIS",
        "severity": "MAJOR", "title": "AMIODARON + DIGOXIN: TĂNG GẤP ĐÔI NỒNG ĐỘ DIGOXIN GÂY LOẠN NHỊP",
        "mech": "Amiodaron ức chế P-gp và giảm độ thanh thải Digoxin qua thận.",
        "conseq": "Ngộ độc Digoxin: Bloc nhĩ thất hoàn toàn, nhịp nhanh thất, rung thất.",
        "action": "Giảm liều Digoxin đi 50% ngay khi bắt đầu dùng Amiodaron và định lượng TDM Digoxin.", "source": "QĐ 5948/QĐ-BYT (Mục 3.2)"
    },
    {
        "id": "RULE_RAAS_POTASSIUM_SPARING", "class_a": "RAAS_INHIBITOR", "class_b": "POTASSIUM_SPARING",
        "severity": "MAJOR", "title": "ỨC CHẾ MEN CHUYỂN / CHẸN AT1 + SPIRONOLACTON: TĂNG KALI MÁU NGUY CẤP",
        "mech": "Hiệp đồng ức chế trục Aldosterone làm giảm đào thải Kali tại ống lượn xa và ống góp.",
        "conseq": "Tăng kali máu kịch phát (> 6.5 mmol/L), loạn nhịp tim thất, ngừng tim đột ngột.",
        "action": "Theo dõi điện giải đồ Kali máu và creatinin sau 3, 7 và 14 ngày. Tránh phối hợp nếu eGFR < 30.", "source": "QĐ 5948/QĐ-BYT; cần đối chiếu khuyến cáo hiện hành"
    },
    {
        "id": "RULE_METFORMIN_CONTRAST", "class_a": "BIGUANIDE", "class_b": "IODINATED_CONTRAST",
        "severity": "MODERATE", "title": "METFORMIN + THUỐC CẢN QUANG IOD: NHIỄM TOAN LACTIC CẤP",
        "mech": "Thuốc cản quang gây suy giảm chức năng thận cấp, làm tích lũy Metformin.",
        "conseq": "Nhiễm toan acid lactic đe dọa tính mạng (tỷ lệ tử vong lên tới 50%).",
        "action": "Ngừng Metformin trước 48 giờ chụp cản quang nếu eGFR < 60 mL/phút. Chỉ dùng lại sau 48h khi thận ổn định.", "source": "QĐ 5948/QĐ-BYT & Hướng dẫn ESUR"
    },
    {
        "id": "RULE_AMIODARONE_SOFOSBUVIR", "class_a": "ANTIARRHYTHMIC_III", "class_b": "ANTIVIRAL_HCV",
        "severity": "CONTRAINDICATED", "title": "AMIODARON + SOFOSBUVIR: NHỊP CHẬM NGUY KỊCH TỬ VONG",
        "mech": "Hiệp đồng độc tính ức chế nút xoang và hệ thống dẫn truyền nhĩ thất.",
        "conseq": "Nhịp chậm xoang kịch phát, bloc nhĩ thất độ 3, vô tâm thu đe dọa tính mạng.",
        "action": "Chống chỉ định phối hợp tuyệt đối. Nếu bắt buộc, theo dõi monitor tim liên tục trong 48h.", "source": "Cảnh báo An Toàn FDA & QĐ 5948/QĐ-BYT"
    },
    {
        "id": "RULE_PAXLOVID_STATIN", "class_a": "STRONG_CYP3A4_INHIBITOR", "class_b": "STATIN_CYP3A4",
        "severity": "CONTRAINDICATED", "title": "PAXLOVID + SIMVASTATIN / ATORVASTATIN: TIÊU CƠ VÂN CẤP TỬ VONG",
        "mech": "Ritonavir ức chế gần như hoàn toàn CYP3A4 làm tăng nồng độ Statin lên gấp hàng chục lần.",
        "conseq": "Tiêu cơ vân cấp (Rhabdomyolysis), myoglobin niệu gây suy thận cấp vô niệu tử vong.",
        "action": "Chống chỉ định phối hợp. Tạm ngừng Simvastatin/Atorvastatin ít nhất 12 giờ trước khi dùng Paxlovid.", "source": "Hướng Dẫn Điều Trị COVID-19 Bộ Y Tế & FDA EUA"
    },
    {
        "id": "RULE_ALLOPURINOL_THIOPURINE", "class_a": "XANTHINE_OXIDASE_INHIBITOR", "class_b": "THIOPURINE",
        "severity": "CONTRAINDICATED", "title": "ALLOPURINOL + AZATHIOPRIN / 6-MP: SUY TỦY XƯƠNG ÁC TÍNH",
        "mech": "Allopurinol ức chế enzym Xanthine Oxidase ngăn cản chuyển hóa bất hoạt Azathioprin/6-MP.",
        "conseq": "Tích lũy nồng độ Thiopurine cực cao gây ức chế tủy xương cấp tính, giảm 3 dòng tế bào máu tử vong.",
        "action": "Tránh phối hợp. Nếu bắt buộc, giảm 75% liều Azathioprin (chỉ dùng 25% liều chuẩn) và theo dõi công thức máu hàng tuần.", "source": "QĐ 5948/QĐ-BYT; cần đối chiếu chuyên luận hiện hành"
    }
]

SAFE_SYNERGIES: list[dict] = [
    {
        "drug_a": "morphin", "drug_b": "paracetamol",
        "title": "MORPHIN + PARACETAMOL: HIỆP ĐỒNG GIẢM ĐAU ĐA MÔ THỨC AN TOÀN",
        "mechanism": "Tác động giảm đau đa cơ chế: Morphin chủ vận thụ thể mu-opioid trung ương, Paracetamol ức chế COX trung ương và kích hoạt con đường Serotonergic giảm đau đi xuống.",
        "consequence": "Tăng hiệu quả giảm đau, tiết kiệm 20-30% liều Morphin, giảm tác dụng phụ ức chế hô hấp và nôn ói. Khuyến cáo bậc thang giảm đau WHO.",
        "action": "Phối hợp có thể được cân nhắc theo chỉ định; duy trì liều Paracetamol theo chuyên luận được duyệt.", "source": "Hướng dẫn giảm đau WHO; cần đối chiếu chuyên luận hiện hành"
    }
]
