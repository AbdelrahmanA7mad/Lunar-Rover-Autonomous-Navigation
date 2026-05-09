import json
import os
from collections import defaultdict
from typing import Any

import numpy as np


def build_q_table(action_size: int):
    return defaultdict(lambda: np.zeros(action_size))


def save_q_table(filepath: str, q_table, epsilon: float, map_data: dict[str, Any] | None = None) -> None:
    data = {
        'q_table': {k: v.tolist() for k, v in q_table.items()},
        'epsilon': epsilon,
    }
    if map_data is not None:
        data['map_data'] = map_data

    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f)


def load_q_table(filepath: str, action_size: int):
    if not os.path.exists(filepath):
        return build_q_table(action_size), None, None

    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)

    q_table = build_q_table(action_size)
    for key, values in data.get('q_table', {}).items():
        q_table[key] = np.array(values)

    epsilon = data.get('epsilon')
    map_data = data.get('map_data')
    return q_table, epsilon, map_data
