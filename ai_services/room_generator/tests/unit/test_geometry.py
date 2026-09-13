import pytest

from curalina_rooms.domain.geometry import BoundingBox


def test_bounding_box_rejects_invalid_mask_coordinates() -> None:
    with pytest.raises(ValueError, match="x1"):
        BoundingBox(x0=0.5, y0=0.1, x1=0.5, y1=0.9)

    with pytest.raises(ValueError, match="y1"):
        BoundingBox(x0=0.1, y0=0.5, x1=0.9, y1=0.5)

    with pytest.raises(ValueError):
        BoundingBox(x0=-0.1, y0=0.1, x1=0.5, y1=0.9)

    with pytest.raises(ValueError):
        BoundingBox(x0=0.1, y0=0.1, x1=1.5, y1=0.9)


def test_bounding_box_overlap_detects_intersection() -> None:
    a = BoundingBox(x0=0.0, y0=0.0, x1=0.5, y1=0.5)
    b = BoundingBox(x0=0.4, y0=0.4, x1=0.9, y1=0.9)
    c = BoundingBox(x0=0.6, y0=0.6, x1=0.9, y1=0.9)

    assert a.overlaps(b)
    assert b.overlaps(a)
    assert not a.overlaps(c)


def test_bounding_box_touching_edges_do_not_overlap() -> None:
    a = BoundingBox(x0=0.0, y0=0.0, x1=0.5, y1=0.5)
    b = BoundingBox(x0=0.5, y0=0.0, x1=1.0, y1=0.5)

    assert not a.overlaps(b)
