from pydantic import BaseModel, ConfigDict

class DrugItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    national_code: str
    brand_name: str
    active_ingredient: str
    concentration: str
    dosage_form: str
    route: str
    standard_unit: str
    group: str
    is_controlled: bool
    is_high_alert: bool
    is_crash_cart: bool
    note: str

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
