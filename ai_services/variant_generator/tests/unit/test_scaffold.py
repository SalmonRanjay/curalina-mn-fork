from importlib import import_module

from _pytest.capture import CaptureFixture

from curalina_variants.bootstrap import build_settings, main


def test_settings_defaults_are_valid() -> None:
    settings = build_settings()

    assert settings.curalina_device == "cpu"
    assert settings.service_port == 8102


def test_main_reports_api_scaffold_status(capsys: CaptureFixture[str]) -> None:
    assert main("api") == 0
    assert "curalina_variants api scaffold ready" in capsys.readouterr().out


def test_main_reports_worker_scaffold_status(capsys: CaptureFixture[str]) -> None:
    assert main("worker") == 0
    assert "curalina_variants worker scaffold ready" in capsys.readouterr().out


def test_required_a0_modules_are_importable() -> None:
    module_names = (
        "curalina_variants.domain",
        "curalina_variants.application",
        "curalina_variants.ports",
        "curalina_variants.adapters",
        "curalina_variants.api",
        "curalina_variants.workers",
    )

    for module_name in module_names:
        assert import_module(module_name).__name__ == module_name
