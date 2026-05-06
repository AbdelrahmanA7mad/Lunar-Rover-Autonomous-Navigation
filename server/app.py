from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse
import asyncio
import json
import os
import sys
import webbrowser
import threading
import glob

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from ai.q_learning import QLearningAgent
from envs.lunar_rover import LunarRoverEnv

app = FastAPI()

MODELS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "models")
os.makedirs(MODELS_DIR, exist_ok=True)
Q_TABLE_PATH = os.path.join(MODELS_DIR, "default_model.json")
GRID_SIZE = 15

# ── Environment & Agent ─────────────────────────
env   = LunarRoverEnv(size=GRID_SIZE, num_craters=8, num_rocks=12)
agent = QLearningAgent(state_size=GRID_SIZE * GRID_SIZE, action_size=env.action_space.n)

# Try loading existing Q-table and Map
map_data = agent.load(Q_TABLE_PATH)
if map_data:
    env.set_terrain(map_data["target"], map_data["start"], map_data["grid"])

# ── Simulation state ────────────────────────────
sim = {
    "mode":          "idle",       # "idle" | "training" | "running"
    "episode":       0,
    "step":          0,
    "total_reward":  0.0,
    "epsilon":       agent.epsilon,
    "rover_pos":     env._start_location.tolist(),
    "target_pos":    env._target_location.tolist(),
    "craters":       [],
    "rocks":         [],
    "speed":         0.12,         # seconds between steps
    "trained_eps":   0,            # how many training episodes done
    "last_outcome":  "",           # "success" | "crater" | "timeout"
    "model_name":    "default_model"
}

clients: list[WebSocket] = []
task: asyncio.Task | None = None

# ── Helpers ─────────────────────────────────────
def extract_terrain(grid):
    craters, rocks = [], []
    for i in range(grid.shape[0]):
        for j in range(grid.shape[1]):
            if grid[i, j] == 1:
                craters.append([i, j])
            elif grid[i, j] == 2:
                rocks.append([i, j])
    return craters, rocks

async def broadcast(data: dict):
    if not clients:
        return
    msg = json.dumps(data)
    dead = []
    for ws in clients:
        try:
            await ws.send_text(msg)
        except Exception:
            dead.append(ws)
    for ws in dead:
        clients.remove(ws)

def get_current_map_data():
    return {
        "target": env._target_location.tolist(),
        "start": env._start_location.tolist(),
        "grid": env.grid.tolist()
    }

def get_available_models():
    files = glob.glob(os.path.join(MODELS_DIR, "*.json"))
    return [os.path.basename(f).replace('.json', '') for f in files]

async def sync_state_initial():
    obs, _ = env.reset()
    craters, rocks = extract_terrain(env.grid)
    sim.update({
        "craters":      craters,
        "rocks":        rocks,
        "target_pos":   env._target_location.tolist(),
        "rover_pos":    env._start_location.tolist(),
        "models":       get_available_models()
    })

# ── Training loop ───────────────────────────────
async def training_loop():
    global sim
    sim["mode"] = "training"
    await sync_state_initial()
    await broadcast(sim)

    while sim["mode"] == "training":
        obs, _ = env.reset()
        sim.update({
            "target_pos":   obs["target"].tolist(),
            "rover_pos":    obs["rover"].tolist(),
            "total_reward": 0.0,
            "step":         0,
        })
        await broadcast(sim)

        done = False
        while not done and sim["mode"] == "training":
            action = agent.choose_action(obs)
            next_obs, reward, terminated, truncated, _ = env.step(action)
            done = terminated or truncated
            agent.learn(obs, action, reward, next_obs, done)
            obs = next_obs

            sim["total_reward"] += reward
            sim["step"]         += 1
            sim["rover_pos"]     = obs["rover"].tolist()
            sim["epsilon"]       = round(agent.epsilon, 4)

            # Determine outcome
            if terminated and reward > 0:
                sim["last_outcome"] = "success"
            elif terminated and reward < 0:
                sim["last_outcome"] = "crater"
            elif truncated:
                sim["last_outcome"] = "timeout"

            await broadcast(sim)
            await asyncio.sleep(sim["speed"])

        agent.update_epsilon()
        sim["episode"]     += 1
        sim["trained_eps"] += 1

        # Auto-save every 100 episodes
        if sim["trained_eps"] % 100 == 0:
            agent.save(os.path.join(MODELS_DIR, f"{sim['model_name']}.json"), get_current_map_data())
            await broadcast({"__event": "saved", "trained_eps": sim["trained_eps"]})

    await broadcast({"__event": "stopped", "mode": sim["mode"]})

# ── Evaluation loop ─────────────────────────────
async def eval_loop():
    global sim
    sim["mode"] = "running"

    # Evaluate using 0 exploration
    old_eps = agent.epsilon
    agent.epsilon = 0.0
    sim["epsilon"] = 0.0
    await sync_state_initial()
    await broadcast(sim)

    while sim["mode"] == "running":
        obs, _ = env.reset()
        sim.update({
            "target_pos":   obs["target"].tolist(),
            "rover_pos":    obs["rover"].tolist(),
            "total_reward": 0.0,
            "step":         0,
        })
        await broadcast(sim)

        done = False
        while not done and sim["mode"] == "running":
            action = agent.choose_action(obs)
            next_obs, reward, terminated, truncated, _ = env.step(action)
            done = terminated or truncated
            obs = next_obs

            sim["total_reward"] += reward
            sim["step"]         += 1
            sim["rover_pos"]     = obs["rover"].tolist()

            if terminated and reward > 0:
                sim["last_outcome"] = "success"
            elif terminated and reward < 0:
                sim["last_outcome"] = "crater"
            elif truncated:
                sim["last_outcome"] = "timeout"

            await broadcast(sim)
            await asyncio.sleep(sim["speed"])

        sim["episode"] += 1
        await asyncio.sleep(0.5)

    agent.epsilon = old_eps
    await broadcast({"__event": "stopped", "mode": sim["mode"]})

def cancel_task():
    global task, sim
    if task and not task.done():
        sim["mode"] = "idle"
        task.cancel()

# ── WebSocket endpoint ───────────────────────────
@app.websocket("/ws")
async def ws_endpoint(ws: WebSocket):
    global task, sim
    await ws.accept()
    clients.append(ws)

    await sync_state_initial()
    await ws.send_text(json.dumps(sim))

    try:
        while True:
            raw = await ws.receive_text()
            cmd = json.loads(raw)
            action = cmd.get("action")

            if action == "train":
                cancel_task()
                await asyncio.sleep(0.1)
                agent.epsilon = max(agent.epsilon, 0.1)
                task = asyncio.create_task(training_loop())

            elif action == "run":
                cancel_task()
                await asyncio.sleep(0.1)
                task = asyncio.create_task(eval_loop())

            elif action == "stop":
                cancel_task()
                await broadcast({"__event": "stopped", "mode": "idle"})

            elif action == "save":
                name = cmd.get("name", sim["model_name"])
                if name:
                    sim["model_name"] = name
                    agent.save(os.path.join(MODELS_DIR, f"{name}.json"), get_current_map_data())
                    sim["models"] = get_available_models()
                    await broadcast({"__event": "saved", "trained_eps": sim["trained_eps"], "models": sim["models"], "model_name": name})

            elif action == "load_model":
                name = cmd.get("name")
                if name:
                    cancel_task()
                    filepath = os.path.join(MODELS_DIR, f"{name}.json")
                    map_data = agent.load(filepath)
                    if map_data:
                        env.set_terrain(map_data["target"], map_data["start"], map_data["grid"])
                    sim["model_name"] = name
                    sim["trained_eps"] = 0
                    sim["episode"] = 0
                    await sync_state_initial()
                    await broadcast(sim)
            
            elif action == "new_map":
                cancel_task()
                env.regenerate_terrain()
                agent.reset_memory()
                sim["model_name"] = "new_model"
                sim["trained_eps"] = 0
                sim["episode"] = 0
                await sync_state_initial()
                await broadcast(sim)

            elif action == "set_speed":
                sim["speed"] = float(cmd.get("value", 0.12))

    except WebSocketDisconnect:
        if ws in clients:
            clients.remove(ws)

# ── Static files & redirect ──────────────────────
frontend_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "frontend")
app.mount("/static", StaticFiles(directory=frontend_dir), name="static")

@app.get("/")
def root():
    return RedirectResponse(url="/static/index.html")

@app.on_event("startup")
async def on_startup():
    def _open():
        import time; time.sleep(1.5)
        webbrowser.open("http://127.0.0.1:8000")
    threading.Thread(target=_open, daemon=True).start()

