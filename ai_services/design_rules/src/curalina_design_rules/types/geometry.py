from dataclasses import dataclass

from curalina_design_rules.types.catalog import ProductInstance
from curalina_design_rules.types.primitives import HomeCategory, RoomType


@dataclass(frozen=True)
class Point:
    x_mm: int
    y_mm: int

    def __post_init__(self) -> None:
        _require_int("x_mm", self.x_mm)
        _require_int("y_mm", self.y_mm)


@dataclass(frozen=True)
class RoomGeometry:
    room_id: str
    room_type: RoomType
    home_category: HomeCategory
    boundary: tuple[Point, ...]
    ceiling_height_mm: int | None = None

    def __post_init__(self) -> None:
        if self.ceiling_height_mm is not None:
            _require_int("ceiling_height_mm", self.ceiling_height_mm)
        if not self.boundary:
            raise ValueError("boundary is required")


@dataclass(frozen=True)
class Placement:
    instance: ProductInstance
    x_mm: int
    y_mm: int
    rotation_deg: int

    def __post_init__(self) -> None:
        _require_int("x_mm", self.x_mm)
        _require_int("y_mm", self.y_mm)
        _require_int("rotation_deg", self.rotation_deg)

    @property
    def instance_id(self) -> str:
        return self.instance.instance_id

    @property
    def product_id(self) -> str:
        return self.instance.product.product_id


def _require_int(field_name: str, value: int) -> None:
    if not isinstance(value, int) or isinstance(value, bool):
        raise TypeError(f"{field_name} must be an integer millimetre value")
