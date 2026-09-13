from importlib import import_module

from _pytest.capture import CaptureFixture

from curalina_recommendation.bootstrap import build_settings, main


def test_settings_defaults_are_valid() -> None:
    settings = build_settings()

    assert settings.curalina_env == "local"
    assert settings.service_port == 8101


def test_main_reports_scaffold_status(capsys: CaptureFixture[str]) -> None:
    assert main() == 0
    assert "curalina_recommendation scaffold ready" in capsys.readouterr().out


def test_required_a0_modules_are_importable() -> None:
    module_names = (
        "curalina_recommendation.domain",
        "curalina_recommendation.application",
        "curalina_recommendation.ports",
        "curalina_recommendation.adapters",
        "curalina_recommendation.api",
    )

    for module_name in module_names:
        assert import_module(module_name).__name__ == module_name
