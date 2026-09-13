from importlib import import_module

from _pytest.capture import CaptureFixture

from curalina_rooms.bootstrap import build_settings, main


def test_settings_defaults_are_valid() -> None:
    settings = build_settings()

    assert settings.curalina_device == "cpu"
    assert settings.service_port == 8103


def test_main_reports_api_scaffold_status(capsys: CaptureFixture[str]) -> None:
    assert main("api") == 0
    assert "curalina_rooms api scaffold ready" in capsys.readouterr().out


def test_main_reports_worker_scaffold_status(capsys: CaptureFixture[str]) -> None:
    assert main("worker") == 0
    assert "curalina_rooms worker scaffold ready" in capsys.readouterr().out


def test_required_a0_modules_are_importable() -> None:
    module_names = (
        "curalina_rooms.domain",
        "curalina_rooms.application",
        "curalina_rooms.ports",
        "curalina_rooms.adapters",
        "curalina_rooms.api",
        "curalina_rooms.workers",
    )

    for module_name in module_names:
        assert import_module(module_name).__name__ == module_name
