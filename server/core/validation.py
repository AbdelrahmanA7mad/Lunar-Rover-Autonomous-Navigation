from dataclasses import dataclass


@dataclass
class SpeedLimits:
    min_value: float = 0.0
    max_value: float = 0.9


def clamp_speed(value: float, limits: SpeedLimits = SpeedLimits()) -> float:
    return max(limits.min_value, min(limits.max_value, value))
