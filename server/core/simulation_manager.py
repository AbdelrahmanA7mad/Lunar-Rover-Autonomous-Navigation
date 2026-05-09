import asyncio
import time
from datetime import datetime
from typing import Any

from fastapi import WebSocket

from ai import QLearningAgent
from envs.lunar_rover import LunarRoverEnv
from server import settings
from server.core.stores import MapStore, ModelStore
from server.core.utils import extract_terrain, json_text
from server.core.validation import clamp_speed


class SimulationManager:
    def __init__(self) -> None:
        self.env = LunarRoverEnv(size=settings.GRID_SIZE, num_craters=settings.NUM_CRATERS, num_rocks=settings.NUM_ROCKS)
        self.agent = QLearningAgent(
            state_size=settings.GRID_SIZE * settings.GRID_SIZE,
            action_size=self.env.action_space.n,
        )

        self.model_store = ModelStore(settings.MODELS_DIR)
        self.map_store = MapStore(settings.MAPS_DIR)

        loaded_map_data = self.agent.load(settings.DEFAULT_MODEL_PATH)
        if loaded_map_data:
            self.env.set_terrain(loaded_map_data['target'], loaded_map_data['start'], loaded_map_data['grid'])

        self.sim = {
            'mode': 'idle',
            'episode': 0,
            'step': 0,
            'total_reward': 0.0,
            'epsilon': self.agent.epsilon,
            'rover_pos': self.env._start_location.tolist(),
            'target_pos': self.env._target_location.tolist(),
            'craters': [],
            'rocks': [],
            'speed': settings.DEFAULT_SPEED,
            'trained_eps': 0,
            'last_outcome': '',
            'model_name': settings.DEFAULT_MODEL_NAME,
            'map_name': '',
            'perf': {'ws_msgs_per_sec': 0.0, 'ws_kb_per_sec': 0.0, 'ws_avg_msg_bytes': 0.0},
        }

        self.perf = {
            'window_start': time.monotonic(),
            'window_msgs': 0,
            'window_bytes': 0,
            'last_msgs_per_sec': 0.0,
            'last_kb_per_sec': 0.0,
            'last_avg_msg_bytes': 0.0,
        }

        self.clients: list[WebSocket] = []
        self.task: asyncio.Task | None = None

        if not self.map_store.list_names():
            generated_name = self._new_map_name()
            self.sim['map_name'] = self.map_store.save(generated_name, self.get_current_map_data())
        else:
            self.sim['map_name'] = self.map_store.list_names()[0]

    def _new_map_name(self) -> str:
        return f"map_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}"

    def get_current_map_data(self) -> dict[str, Any]:
        return {
            'target': self.env._target_location.tolist(),
            'start': self.env._start_location.tolist(),
            'grid': self.env.grid.tolist(),
        }

    def _refresh_catalogs(self) -> None:
        self.sim['models'] = self.model_store.list_names()
        self.sim['maps'] = self.map_store.list_names()

    async def sync_state_initial(self) -> None:
        self.env.reset()
        craters, rocks = extract_terrain(self.env.grid)
        self._refresh_catalogs()
        self.sim.update({
            'craters': craters,
            'rocks': rocks,
            'target_pos': self.env._target_location.tolist(),
            'rover_pos': self.env._start_location.tolist(),
        })

    def static_payload(self) -> dict[str, Any]:
        return {
            'mode': self.sim['mode'],
            'episode': self.sim['episode'],
            'step': self.sim['step'],
            'total_reward': self.sim['total_reward'],
            'epsilon': self.sim['epsilon'],
            'rover_pos': self.sim['rover_pos'],
            'target_pos': self.sim['target_pos'],
            'craters': self.sim['craters'],
            'rocks': self.sim['rocks'],
            'trained_eps': self.sim['trained_eps'],
            'last_outcome': self.sim['last_outcome'],
            'model_name': self.sim['model_name'],
            'map_name': self.sim.get('map_name', ''),
            'models': self.sim.get('models', []),
            'maps': self.sim.get('maps', []),
            'perf': self.sim.get('perf', {}),
        }

    def step_payload(self) -> dict[str, Any]:
        return {
            'mode': self.sim['mode'],
            'episode': self.sim['episode'],
            'step': self.sim['step'],
            'total_reward': self.sim['total_reward'],
            'epsilon': self.sim['epsilon'],
            'rover_pos': self.sim['rover_pos'],
            'target_pos': self.sim['target_pos'],
            'trained_eps': self.sim['trained_eps'],
            'last_outcome': self.sim['last_outcome'],
            'perf': self.sim.get('perf', {}),
        }

    async def emit_event(self, event: str, **data) -> None:
        await self.broadcast({'__event': event, **data})

    async def broadcast(self, data: dict[str, Any]) -> None:
        if not self.clients:
            return

        msg = json_text(data)
        now = time.monotonic()
        self.perf['window_msgs'] += 1
        self.perf['window_bytes'] += len(msg.encode('utf-8'))

        elapsed = now - self.perf['window_start']
        if elapsed >= 1.0:
            self.perf['last_msgs_per_sec'] = self.perf['window_msgs'] / elapsed
            self.perf['last_kb_per_sec'] = (self.perf['window_bytes'] / 1024.0) / elapsed
            self.perf['last_avg_msg_bytes'] = self.perf['window_bytes'] / self.perf['window_msgs'] if self.perf['window_msgs'] else 0.0
            self.perf['window_start'] = now
            self.perf['window_msgs'] = 0
            self.perf['window_bytes'] = 0

        self.sim['perf'] = {
            'ws_msgs_per_sec': round(self.perf['last_msgs_per_sec'], 2),
            'ws_kb_per_sec': round(self.perf['last_kb_per_sec'], 2),
            'ws_avg_msg_bytes': round(self.perf['last_avg_msg_bytes'], 1),
        }

        dead = []
        for ws in self.clients:
            try:
                await ws.send_text(msg)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.clients.remove(ws)

    def cancel_task(self) -> None:
        if self.task and not self.task.done():
            self.sim['mode'] = 'idle'
            self.task.cancel()

    async def create_new_map(self) -> str:
        self.env.regenerate_terrain()
        self.agent.reset_memory()
        self.sim['model_name'] = 'new_model'
        self.sim['trained_eps'] = 0
        self.sim['episode'] = 0
        name = self.map_store.save(self._new_map_name(), self.get_current_map_data())
        self.sim['map_name'] = name
        await self.sync_state_initial()
        return name

    async def load_map(self, map_name: str) -> bool:
        map_data = self.map_store.load(map_name)
        if not map_data:
            return False
        self.cancel_task()
        self.env.set_terrain(map_data['target'], map_data['start'], map_data['grid'])
        self.agent.reset_memory()
        self.sim['map_name'] = map_name
        self.sim['model_name'] = 'new_model'
        self.sim['trained_eps'] = 0
        self.sim['episode'] = 0
        await self.sync_state_initial()
        return True

    def save_model(self, requested_name: str) -> str:
        safe_name = self.model_store.sanitize(requested_name)
        self.sim['model_name'] = safe_name
        path = self.model_store.path_for(safe_name)
        self.agent.save(path, self.get_current_map_data())
        self._refresh_catalogs()
        return safe_name

    async def load_model(self, name: str) -> tuple[bool, str]:
        safe_name = self.model_store.sanitize(name)
        path = self.model_store.path_for(safe_name)
        map_data = self.agent.load(path)
        if map_data is None:
            return False, f"Model '{safe_name}' not found or invalid."
        if not all(k in map_data for k in ('target', 'start', 'grid')):
            return False, f"Model '{safe_name}' is missing map data."

        self.cancel_task()
        self.env.set_terrain(map_data['target'], map_data['start'], map_data['grid'])
        self.sim['model_name'] = safe_name
        self.sim['trained_eps'] = 0
        self.sim['episode'] = 0

        map_name = self.map_store.save(f'{safe_name}_map', map_data)
        self.sim['map_name'] = map_name
        await self.sync_state_initial()
        return True, ''

    def set_speed(self, value: float) -> float:
        self.sim['speed'] = clamp_speed(float(value))
        return self.sim['speed']

    async def training_loop(self) -> None:
        self.sim['mode'] = 'training'
        await self.sync_state_initial()
        await self.broadcast(self.static_payload())

        while self.sim['mode'] == 'training':
            obs, _ = self.env.reset()
            self.sim.update({
                'target_pos': obs['target'].tolist(),
                'rover_pos': obs['rover'].tolist(),
                'total_reward': 0.0,
                'step': 0,
            })
            await self.broadcast(self.step_payload())

            done = False
            while not done and self.sim['mode'] == 'training':
                action = self.agent.choose_action(obs)
                next_obs, reward, terminated, truncated, _ = self.env.step(action)
                done = terminated or truncated
                self.agent.learn(obs, action, reward, next_obs, done)
                obs = next_obs

                self.sim['total_reward'] += reward
                self.sim['step'] += 1
                self.sim['rover_pos'] = obs['rover'].tolist()
                self.sim['epsilon'] = round(self.agent.epsilon, 4)

                if terminated and reward > 0:
                    self.sim['last_outcome'] = 'success'
                elif terminated and reward < 0:
                    self.sim['last_outcome'] = 'crater'
                elif truncated:
                    self.sim['last_outcome'] = 'timeout'

                await self.broadcast(self.step_payload())
                await asyncio.sleep(self.sim['speed'])

            self.agent.update_epsilon()
            self.sim['episode'] += 1
            self.sim['trained_eps'] += 1

            if self.sim['trained_eps'] % 100 == 0:
                self.save_model(self.sim['model_name'])
                await self.emit_event('saved', trained_eps=self.sim['trained_eps'], models=self.sim.get('models', []), model_name=self.sim['model_name'])

        await self.emit_event('stopped', mode=self.sim['mode'])

    async def eval_loop(self) -> None:
        self.sim['mode'] = 'running'
        old_eps = self.agent.epsilon
        self.agent.epsilon = 0.0
        self.sim['epsilon'] = 0.0
        await self.sync_state_initial()
        await self.broadcast(self.static_payload())

        while self.sim['mode'] == 'running':
            obs, _ = self.env.reset()
            self.sim.update({
                'target_pos': obs['target'].tolist(),
                'rover_pos': obs['rover'].tolist(),
                'total_reward': 0.0,
                'step': 0,
            })
            await self.broadcast(self.step_payload())

            done = False
            while not done and self.sim['mode'] == 'running':
                action = self.agent.choose_action(obs)
                next_obs, reward, terminated, truncated, _ = self.env.step(action)
                done = terminated or truncated
                obs = next_obs

                self.sim['total_reward'] += reward
                self.sim['step'] += 1
                self.sim['rover_pos'] = obs['rover'].tolist()

                if terminated and reward > 0:
                    self.sim['last_outcome'] = 'success'
                elif terminated and reward < 0:
                    self.sim['last_outcome'] = 'crater'
                elif truncated:
                    self.sim['last_outcome'] = 'timeout'

                await self.broadcast(self.step_payload())
                await asyncio.sleep(self.sim['speed'])

            self.sim['episode'] += 1
            await asyncio.sleep(0.5)

        self.agent.epsilon = old_eps
        await self.emit_event('stopped', mode=self.sim['mode'])
