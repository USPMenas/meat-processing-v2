from __future__ import annotations

import json
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

BASE_URL = "https://bor.gs/tcc"
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/135.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json,text/plain,*/*",
    "Referer": "https://bor.gs/tcc/docs",
}

FIXTURE_DIR = Path(__file__).resolve().parent.parent / "fixtures"


def fetch_json(path: str, params: dict[str, str] | None = None) -> dict:
    query = f"?{urlencode(params)}" if params else ""
    url = f"{BASE_URL}{path}{query}"
    request = Request(url, headers=HEADERS)
    with urlopen(request, timeout=180) as response:
        return json.loads(response.read().decode("utf-8"))


def fetch_error_json(path: str, params: dict[str, str] | None = None) -> dict:
    query = f"?{urlencode(params)}" if params else ""
    url = f"{BASE_URL}{path}{query}"
    request = Request(url, headers=HEADERS)
    try:
        with urlopen(request, timeout=180):
            raise RuntimeError("Expected HTTP error but request succeeded")
    except HTTPError as exc:
        return json.loads(exc.read().decode("utf-8"))


def write_json(name: str, payload: dict) -> None:
    FIXTURE_DIR.mkdir(parents=True, exist_ok=True)
    target = FIXTURE_DIR / name
    target.write_text(
        json.dumps(payload, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )


def build_use_operational_data_example() -> dict:
    channel_payload = fetch_json(
        "/lab",
        {
            "from_time": "2026-03-31T11:40:00",
            "to_time": "2026-03-31T11:41:00",
        },
    )

    latest = channel_payload["measurements"][:3]
    by_sensor = {item["sensor"]: item for item in latest}

    freezer = by_sensor["fase3"]
    equipment = [by_sensor["fase1"], by_sensor["fase2"]]
    equipment_energy = equipment[0]["active_power"] + equipment[1]["active_power"]
    equipment_current = equipment[0]["current"] + equipment[1]["current"]

    freezer_mean = 7.95
    freezer_p05 = 5.36
    freezer_p95 = 10.00
    equipment_current_p10 = 0.0822
    equipment_current_p95 = 0.2673

    temperature = max(
        -22.0,
        min(
            -14.0,
            -18.0
            + ((freezer["active_power"] - freezer_mean) / (freezer_p95 - freezer_p05))
            * 2.5,
        ),
    )
    occupancy = max(
        0,
        min(
            100,
            round(
                10
                + 90
                * (
                    (equipment_current - equipment_current_p10)
                    / (equipment_current_p95 - equipment_current_p10)
                )
            ),
        ),
    )

    return {
        "channel": "lab",
        "timestamp": freezer["timestamp"],
        "sensorMap": {"freezer": "fase3", "equipment": ["fase1", "fase2"]},
        "source": {
            "freezerMeasurement": freezer,
            "equipmentMeasurements": equipment,
        },
        "derived": {
            "freezerEnergyKw": round(freezer["active_power"], 4),
            "equipmentEnergyKw": round(equipment_energy, 4),
            "equipmentCurrentA": round(equipment_current, 4),
            "temperatureC": round(temperature, 1),
            "occupancyPct": occupancy,
            "alerts": [
                {
                    "type": "critical",
                    "code": "stale_data",
                    "message": (
                        "Ultima medicao disponivel em 2026-03-31T11:40:56; "
                        "em 2026-04-07 isso nao pode ser exibido como dado ao vivo."
                    ),
                }
            ],
            "isStale": True,
        },
    }


def main() -> None:
    fixtures = {
        "channel-lab-1min.json": fetch_json(
            "/lab",
            {
                "from_time": "2026-03-31T11:40:00",
                "to_time": "2026-03-31T11:41:00",
            },
        ),
        "sensor-lab-fase1-1min.json": fetch_json(
            "/lab/fase1",
            {
                "from_time": "2026-03-31T11:40:00",
                "to_time": "2026-03-31T11:41:00",
            },
        ),
        "channel-lab-default-empty-24h.json": fetch_json("/lab"),
        "consumption-lab-1d.json": fetch_json(
            "/analytics/lab/consumption",
            {
                "from_time": "2026-03-30T00:00:00",
                "to_time": "2026-03-31T00:00:00",
            },
        ),
        "consumption-lab-default-empty-24h.json": fetch_json(
            "/analytics/lab/consumption"
        ),
        "demand-peaks-lab-1d.json": fetch_json(
            "/analytics/lab/demand_peaks",
            {
                "from_time": "2026-03-30T00:00:00",
                "to_time": "2026-03-31T00:00:00",
            },
        ),
        "electrical-health-lab-1d.json": fetch_json(
            "/analytics/lab/electrical_health",
            {
                "from_time": "2026-03-30T00:00:00",
                "to_time": "2026-03-31T00:00:00",
            },
        ),
        "hourly-profile-lab-7d.json": fetch_json(
            "/analytics/lab/hourly_profile",
            {
                "from_time": "2026-03-24T00:00:00",
                "to_time": "2026-03-31T00:00:00",
            },
        ),
        "current-by-sensor-lab-7d.json": fetch_json(
            "/analytics/lab/current_by_sensor",
            {
                "from_time": "2026-03-24T00:00:00",
                "to_time": "2026-03-31T00:00:00",
            },
        ),
        "voltage-anomalies-lab-120-132-127.json": fetch_json(
            "/analytics/lab/voltage_anomalies",
            {
                "from_time": "2025-12-01T00:00:00",
                "to_time": "2026-03-31T23:59:59",
                "lower_limit": "120",
                "upper_limit": "132",
                "nominal_voltage": "127",
            },
        ),
        "error-invalid-from-time-400.json": fetch_error_json(
            "/lab",
            {
                "from_time": "not-a-date",
                "to_time": "2026-03-31T00:00:00",
            },
        ),
        "useOperationalData-example.json": build_use_operational_data_example(),
    }

    manifest = {
        "captured_at": "2026-04-07T11:44:29-03:00",
        "api_base_url": BASE_URL,
        "files": list(fixtures.keys()),
    }

    for name, payload in fixtures.items():
        write_json(name, payload)

    write_json("manifest.json", manifest)


if __name__ == "__main__":
    main()
