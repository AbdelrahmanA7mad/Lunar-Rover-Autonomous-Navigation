def encode_lunar_state(state: dict) -> str:
    rover_pos = f"{state['rover'][0]},{state['rover'][1]}"
    target_pos = f"{state['target'][0]},{state['target'][1]}"
    return f"{rover_pos}|{target_pos}"
