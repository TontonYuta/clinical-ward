from pydantic import BaseModel, ConfigDict

class DrugItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    national_code: str
    brand_name: str
    active_ingredient: str
    concentration: str | None = ""
    dosage_form: str | None = ""
    route: str | None = ""
    standard_unit: str | None = "Viên"
    group: str | None = "Thuốc điều trị chuyên khoa"
    is_controlled: bool | None = False
    is_high_alert: bool | None = False
    is_crash_cart: bool | None = False
    note: str | None = ""
    packaging_spec: str | None = ""
    standard_pharmacopeia: str | None = "NSX"
    shelf_life: str | None = "36 tháng"
    manufacturer: str | None = ""
    country: str | None = "Việt Nam"
    applicant_name: str | None = ""
    approval_decision: str | None = ""
    hdsd_path: str | None = None
    label_path: str | None = None

    # Thông tin lâm sàng Dược Thư Quốc Gia
    atc_code: str | None = None
    drug_class: str | None = None
    indications: str | None = None
    contraindications: str | None = None
    precautions: str | None = None
    pregnancy_warning: str | None = None
    adult_dosage: str | None = None
    pediatric_dosage: str | None = None
    renal_adjustment: str | None = None
    hepatic_adjustment: str | None = None
    adverse_effects: str | None = None
    drug_interactions: str | None = None
    overdose_treatment: str | None = None
    antidote: str | None = None
    clinical_source: str | None = None
    clinical_monograph_id: str | None = None

class RegistryPaginatedResponse(BaseModel):
    total: int
    page: int
    page_size: int
    total_pages: int
    group_stats: dict[str, int]
    items: list[DrugItemResponse]

class RegistryStatsResponse(BaseModel):
    total_drugs: int
    category_stats: dict[str, int]
    source: str
