from dataclasses import dataclass

from curalina_design_rules.types.primitives import Money, ProductCategory


@dataclass(frozen=True)
class ProductAttributes:
    curved_edges: bool | None = None
    visible_leg_height_mm: int | None = None
    material_class: str | None = None
    gloss_level: str | None = None
    undertone_temperature: str | None = None
    performance_fabric: bool | None = None
    in_proportion_scope: bool = False

    def __post_init__(self) -> None:
        if self.visible_leg_height_mm is not None:
            _require_int("visible_leg_height_mm", self.visible_leg_height_mm)


@dataclass(frozen=True)
class Product:
    product_id: str
    name: str
    category: ProductCategory
    width_mm: int
    depth_mm: int
    height_mm: int
    price: Money | None
    attributes: ProductAttributes

    def __post_init__(self) -> None:
        _require_int("width_mm", self.width_mm)
        _require_int("depth_mm", self.depth_mm)
        _require_int("height_mm", self.height_mm)


@dataclass(frozen=True)
class ProductInstance:
    instance_id: str
    product: Product
    quantity_index: int = 1

    def __post_init__(self) -> None:
        _require_int("quantity_index", self.quantity_index)


def _require_int(field_name: str, value: int) -> None:
    if not isinstance(value, int) or isinstance(value, bool):
        raise TypeError(f"{field_name} must be an integer millimetre value")
