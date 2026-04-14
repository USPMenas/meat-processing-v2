from __future__ import annotations

import argparse
import json
import sqlite3
from collections import defaultdict
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any


CHANNEL = "lab"
FREEZER_SENSORS = {"fase3"}
EQUIPMENT_SENSORS = {"fase1", "fase2"}
RECENT_WINDOW_HOURS = 2
PERIOD_CONFIG = {
    "24h": {"hours": 24, "bucket_minutes": 15},
    "7d": {"hours": 7 * 24, "bucket_minutes": 60},
    "30d": {"hours": 30 * 24, "bucket_minutes": 360},
}
TEMPERATURE_CONFIG = {
    "baseTemperature": 0.0,
    "avgPower": 7.95,
    "sensitivityFactor": 2.5 / (10.0 - 5.36),
    "minTemperature": -5.0,
    "maxTemperature": 2.0,
}
OCCUPANCY_CONFIG = {
    "baseOccupancy": 10.0,
    "avgCurrent": 0.0822,
    "maxCurrent": 0.2673 - 0.0822,
    "scaleFactor": 90.0,
    "minOccupancy": 0.0,
    "maxOccupancy": 100.0,
}


@dataclass
class MeasurementRow:
    channel: str
    sensor: str
    apparent_power: float
    active_power: float
    reactive_power: float
    power_factor: float
    current: float
    voltage: float
    timestamp: str


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate bundled fallback snapshots from a SQLite backup."
    )
    parser.add_argument(
        "--db",
        default=str(Path.home() / "Downloads" / "backup_2026-03-31.db"),
        help="Absolute path to the SQLite backup.",
    )
    parser.add_argument(
        "--output-dir",
        default=str(Path(__file__).resolve().parents[1] / "src" / "data" / "backup"),
        help="Directory where manifest and channel snapshots will be written.",
    )
    return parser.parse_args()


def parse_timestamp(value: str) -> datetime:
    return datetime.fromisoformat(value)


def isoformat(value: datetime) -> str:
    return value.replace(microsecond=0).isoformat()


def round2(value: float) -> float:
    return round(value + 1e-9, 2)


def clamp(value: float, min_value: float, max_value: float) -> float:
    return min(max(value, min_value), max_value)


def derive_temperature(active_power: float) -> float:
    derived = (
        TEMPERATURE_CONFIG["baseTemperature"]
        + (active_power - TEMPERATURE_CONFIG["avgPower"])
        * TEMPERATURE_CONFIG["sensitivityFactor"]
    )
    return round2(
        clamp(
            derived,
            TEMPERATURE_CONFIG["minTemperature"],
            TEMPERATURE_CONFIG["maxTemperature"],
        )
    )


def derive_occupancy(current: float) -> float:
    normalized_max = OCCUPANCY_CONFIG["maxCurrent"] or 1.0
    derived = (
        OCCUPANCY_CONFIG["baseOccupancy"]
        + ((current - OCCUPANCY_CONFIG["avgCurrent"]) / normalized_max)
        * OCCUPANCY_CONFIG["scaleFactor"]
    )
    return round2(
        clamp(
            derived,
            OCCUPANCY_CONFIG["minOccupancy"],
            OCCUPANCY_CONFIG["maxOccupancy"],
        )
    )


def floor_bucket(start: datetime, current: datetime, bucket_minutes: int) -> datetime:
    elapsed_seconds = max((current - start).total_seconds(), 0)
    bucket_index = int(elapsed_seconds // (bucket_minutes * 60))
    return start + timedelta(minutes=bucket_index * bucket_minutes)


def row_from_tuple(row: tuple[Any, ...]) -> MeasurementRow:
    return MeasurementRow(
        channel=row[0],
        sensor=row[1],
        apparent_power=float(row[2]),
        active_power=float(row[3]),
        reactive_power=float(row[4]),
        power_factor=float(row[5]),
        current=float(row[6]),
        voltage=float(row[7]),
        timestamp=row[8],
    )


def to_measurement_dict(row: MeasurementRow) -> dict[str, Any]:
    return {
        "channel": row.channel,
        "sensor": row.sensor,
        "apparent_power": round2(row.apparent_power),
        "active_power": round2(row.active_power),
        "reactive_power": round2(row.reactive_power),
        "power_factor": round2(row.power_factor),
        "current": round2(row.current),
        "voltage": round2(row.voltage),
        "timestamp": row.timestamp,
    }


def build_operational_point(rows_by_sensor: dict[str, MeasurementRow]) -> dict[str, Any] | None:
    if not rows_by_sensor:
        return None

    freezer_energy = sum(
        row.active_power
        for sensor, row in rows_by_sensor.items()
        if sensor in FREEZER_SENSORS
    )
    equipment_energy = sum(
        row.active_power
        for sensor, row in rows_by_sensor.items()
        if sensor in EQUIPMENT_SENSORS
    )
    equipment_current = sum(
        row.current for sensor, row in rows_by_sensor.items() if sensor in EQUIPMENT_SENSORS
    )
    timestamp = max(row.timestamp for row in rows_by_sensor.values())

    return {
        "freezerEnergy": round2(freezer_energy),
        "equipmentEnergy": round2(equipment_energy),
        "temperature": derive_temperature(freezer_energy),
        "occupancy": derive_occupancy(equipment_current),
        "timestamp": timestamp,
    }


def build_bucketed_history(
    connection: sqlite3.Connection,
    latest_dt: datetime,
) -> tuple[list[dict[str, Any]], dict[str, dict[str, Any]]]:
    history_maps: dict[str, dict[str, dict[str, MeasurementRow]]] = {
        period: {} for period in PERIOD_CONFIG
    }
    recent_map: dict[str, dict[str, MeasurementRow]] = {}
    start_30d = latest_dt - timedelta(hours=PERIOD_CONFIG["30d"]["hours"])
    recent_start = latest_dt - timedelta(hours=RECENT_WINDOW_HOURS)

    cursor = connection.execute(
        """
        SELECT channel, sensor, apparent_power, active_power, reactive_power,
               power_factor, current, voltage, timestamp
        FROM measurements
        WHERE channel = ? AND timestamp >= ? AND timestamp <= ?
        ORDER BY timestamp ASC
        """,
        (CHANNEL, isoformat(start_30d), isoformat(latest_dt)),
    )

    for raw_row in cursor:
        row = row_from_tuple(raw_row)
        timestamp_dt = parse_timestamp(row.timestamp)

        if timestamp_dt >= recent_start:
            recent_bucket = floor_bucket(recent_start, timestamp_dt, 1)
            recent_map.setdefault(isoformat(recent_bucket), {})[row.sensor] = row

        for period, config in PERIOD_CONFIG.items():
            period_start = latest_dt - timedelta(hours=config["hours"])
            if timestamp_dt < period_start:
                continue
            bucket = floor_bucket(period_start, timestamp_dt, config["bucket_minutes"])
            history_maps[period].setdefault(isoformat(bucket), {})[row.sensor] = row

    recent_measurements = [
        to_measurement_dict(row)
        for _, rows_by_sensor in sorted(recent_map.items())
        for row in sorted(rows_by_sensor.values(), key=lambda item: item.sensor)
    ]
    histories: dict[str, dict[str, Any]] = {}

    for period, bucket_map in history_maps.items():
        points = []
        for _, rows_by_sensor in sorted(bucket_map.items()):
            point = build_operational_point(rows_by_sensor)
            if point:
                points.append(point)

        histories[period] = {
            "anchorMeasurementAt": isoformat(latest_dt),
            "period": period,
            "points": points,
        }

    return recent_measurements, histories


def build_hourly_profile(connection: sqlite3.Connection, start_30d: datetime, end_dt: datetime) -> dict[str, Any]:
    rows = connection.execute(
        """
        SELECT substr(timestamp, 12, 2) AS hour, sensor, AVG(active_power)
        FROM measurements
        WHERE channel = ? AND timestamp >= ? AND timestamp <= ?
        GROUP BY hour, sensor
        ORDER BY hour ASC, sensor ASC
        """,
        (CHANNEL, isoformat(start_30d), isoformat(end_dt)),
    ).fetchall()

    return {
        "channel": CHANNEL,
        "from": isoformat(start_30d),
        "to": isoformat(end_dt),
        "results": [
            {
                "hour": row[0],
                "sensor": row[1],
                "avg_power_kw": round2(float(row[2])),
            }
            for row in rows
        ],
    }


def build_current_by_sensor(
    connection: sqlite3.Connection, start_30d: datetime, end_dt: datetime
) -> dict[str, Any]:
    rows = connection.execute(
        """
        SELECT sensor, AVG(current)
        FROM measurements
        WHERE channel = ? AND timestamp >= ? AND timestamp <= ?
        GROUP BY sensor
        ORDER BY sensor ASC
        """,
        (CHANNEL, isoformat(start_30d), isoformat(end_dt)),
    ).fetchall()

    return {
        "channel": CHANNEL,
        "from": isoformat(start_30d),
        "to": isoformat(end_dt),
        "results": [
            {
                "sensor": row[0],
                "avg_current": round2(float(row[1])),
            }
            for row in rows
        ],
    }


def build_electrical_health(
    connection: sqlite3.Connection, start_30d: datetime, end_dt: datetime
) -> dict[str, Any]:
    rows = connection.execute(
        """
        SELECT sensor, AVG(voltage), AVG(power_factor)
        FROM measurements
        WHERE channel = ? AND timestamp >= ? AND timestamp <= ?
        GROUP BY sensor
        ORDER BY sensor ASC
        """,
        (CHANNEL, isoformat(start_30d), isoformat(end_dt)),
    ).fetchall()

    return {
        "channel": CHANNEL,
        "from": isoformat(start_30d),
        "to": isoformat(end_dt),
        "results": [
            {
                "sensor": row[0],
                "avg_voltage": round2(float(row[1])),
                "avg_power_factor": round2(float(row[2])),
            }
            for row in rows
        ],
    }


def build_demand_peaks(
    connection: sqlite3.Connection, start_30d: datetime, end_dt: datetime
) -> dict[str, Any]:
    rows = connection.execute(
        """
        SELECT sensor, active_power, timestamp
        FROM measurements
        WHERE channel = ? AND timestamp >= ? AND timestamp <= ?
        ORDER BY sensor ASC, active_power DESC, timestamp DESC
        """,
        (CHANNEL, isoformat(start_30d), isoformat(end_dt)),
    )
    peaks: dict[str, dict[str, Any]] = {}

    for sensor, active_power, timestamp in rows:
        if sensor in peaks:
            continue
        peaks[sensor] = {
            "sensor": sensor,
            "peak_kw": round2(float(active_power)),
            "timestamp": timestamp,
        }

    return {
        "channel": CHANNEL,
        "from": isoformat(start_30d),
        "to": isoformat(end_dt),
        "results": [peaks[sensor] for sensor in sorted(peaks)],
    }


def build_consumption(
    connection: sqlite3.Connection, start_30d: datetime, end_dt: datetime
) -> dict[str, Any]:
    rows = connection.execute(
        """
        SELECT sensor, timestamp, active_power
        FROM measurements
        WHERE channel = ? AND timestamp >= ? AND timestamp <= ?
        ORDER BY sensor ASC, timestamp ASC
        """,
        (CHANNEL, isoformat(start_30d), isoformat(end_dt)),
    )
    stats: dict[str, dict[str, Any]] = defaultdict(
        lambda: {
            "sensor": "",
            "total_kwh": 0.0,
            "min_demand_kw": float("inf"),
            "max_demand_kw": 0.0,
            "_previous_power": None,
            "_previous_timestamp": None,
        }
    )

    for sensor, timestamp, active_power in rows:
        active_power_value = float(active_power)
        current = stats[sensor]
        current["sensor"] = sensor
        current["min_demand_kw"] = min(current["min_demand_kw"], active_power_value)
        current["max_demand_kw"] = max(current["max_demand_kw"], active_power_value)

        previous_timestamp = current["_previous_timestamp"]
        previous_power = current["_previous_power"]
        if previous_timestamp is not None and previous_power is not None:
          delta_hours = max(
              (parse_timestamp(timestamp) - previous_timestamp).total_seconds(), 0.0
          ) / 3600.0
          current["total_kwh"] += previous_power * delta_hours

        current["_previous_timestamp"] = parse_timestamp(timestamp)
        current["_previous_power"] = active_power_value

    results = []
    for sensor in sorted(stats):
        entry = stats[sensor]
        min_demand = 0.0 if entry["min_demand_kw"] == float("inf") else entry["min_demand_kw"]
        results.append(
            {
                "sensor": sensor,
                "total_kwh": round2(entry["total_kwh"]),
                "min_demand_kw": round2(min_demand),
                "max_demand_kw": round2(entry["max_demand_kw"]),
            }
        )

    return {
        "channel": CHANNEL,
        "from": isoformat(start_30d),
        "to": isoformat(end_dt),
        "results": results,
    }


def build_snapshot(connection: sqlite3.Connection, db_name: str) -> tuple[dict[str, Any], dict[str, Any]]:
    measurement_range = connection.execute(
        """
        SELECT MIN(timestamp), MAX(timestamp)
        FROM measurements
        WHERE channel = ?
        """,
        (CHANNEL,),
    ).fetchone()
    sensors = [
        row[0]
        for row in connection.execute(
            """
            SELECT DISTINCT sensor
            FROM measurements
            WHERE channel = ?
            ORDER BY sensor ASC
            """,
            (CHANNEL,),
        ).fetchall()
    ]
    latest_dt = parse_timestamp(measurement_range[1])
    generated_at = datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    start_30d = latest_dt - timedelta(hours=PERIOD_CONFIG["30d"]["hours"])
    recent_measurements, histories = build_bucketed_history(connection, latest_dt)
    snapshot = {
        "channel": CHANNEL,
        "generatedAt": generated_at,
        "source": db_name,
        "sensors": sensors,
        "latestMeasurementAt": measurement_range[1],
        "measurementRange": {
            "from": measurement_range[0],
            "to": measurement_range[1],
        },
        "operational": {
            "recentMeasurements": recent_measurements,
            "histories": histories,
        },
        "logistics": {
            "hourlyProfile": build_hourly_profile(connection, start_30d, latest_dt),
            "currentBySensor": build_current_by_sensor(connection, start_30d, latest_dt),
        },
        "business": {
            "consumption": build_consumption(connection, start_30d, latest_dt),
            "demandPeaks": build_demand_peaks(connection, start_30d, latest_dt),
            "electricalHealth": build_electrical_health(connection, start_30d, latest_dt),
        },
    }
    manifest = {
        "generatedAt": generated_at,
        "source": db_name,
        "defaultChannel": CHANNEL,
        "channels": [
            {
                "channel": CHANNEL,
                "snapshotId": CHANNEL,
                "sensors": sensors,
                "latestMeasurementAt": measurement_range[1],
                "measurementRange": {
                    "from": measurement_range[0],
                    "to": measurement_range[1],
                },
            }
        ],
    }
    return manifest, snapshot


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=True, indent=2), encoding="utf-8")


def main() -> None:
    args = parse_args()
    db_path = Path(args.db)
    output_dir = Path(args.output_dir)

    if not db_path.exists():
        raise FileNotFoundError(f"SQLite backup not found: {db_path}")

    connection = sqlite3.connect(str(db_path))
    try:
        manifest, snapshot = build_snapshot(connection, db_path.name)
    finally:
        connection.close()

    write_json(output_dir / "manifest.json", manifest)
    write_json(output_dir / f"{CHANNEL}.snapshot.json", snapshot)
    print(f"Snapshot written to {output_dir}")


if __name__ == "__main__":
    main()
