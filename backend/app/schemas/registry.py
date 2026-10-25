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
