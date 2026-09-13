from importlib import import_module

import curalina_design_rules


def test_package_exports_version() -> None:
    assert curalina_design_rules.__version__ == "0.0.0"


def test_required_a0_modules_are_importable() -> None:
    module_names = (
        "curalina_design_rules.types",
        "curalina_design_rules.constitution",
        "curalina_design_rules.spatial",
        "curalina_design_rules.pipeline",
    )

    for module_name in module_names:
        assert import_module(module_name).__name__ == module_name
