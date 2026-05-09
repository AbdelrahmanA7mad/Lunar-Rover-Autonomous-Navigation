import random

import numpy as np

from ai.core.config import QLearningConfig
from ai.core.persistence import build_q_table, load_q_table, save_q_table
from ai.core.state_encoder import encode_lunar_state


class QLearningAgent:
    def __init__(self, state_size: int, action_size: int, lr=0.1, gamma=0.99, epsilon=1.0, epsilon_decay=0.995, min_epsilon=0.01):
        self.state_size = state_size
        self.action_size = action_size
        self.config = QLearningConfig(
            learning_rate=lr,
            discount_factor=gamma,
            epsilon=epsilon,
            epsilon_decay=epsilon_decay,
            min_epsilon=min_epsilon,
        )
        self.epsilon = self.config.epsilon
        self.q_table = build_q_table(action_size)

    def _state_key(self, state):
        return encode_lunar_state(state)

    def choose_action(self, state):
        key = self._state_key(state)
        if random.random() < self.epsilon:
            return random.randint(0, self.action_size - 1)
        return int(np.argmax(self.q_table[key]))

    def learn(self, state, action, reward, next_state, done):
        state_key = self._state_key(state)
        next_state_key = self._state_key(next_state)

        target = reward
        if not done:
            target += self.config.discount_factor * np.max(self.q_table[next_state_key])

        self.q_table[state_key][action] += self.config.learning_rate * (target - self.q_table[state_key][action])

    def update_epsilon(self):
        if self.epsilon > self.config.min_epsilon:
            self.epsilon *= self.config.epsilon_decay
            self.epsilon = max(self.config.min_epsilon, self.epsilon)

    def save(self, filepath, map_data=None):
        save_q_table(filepath, self.q_table, self.epsilon, map_data)

    def load(self, filepath):
        q_table, epsilon, map_data = load_q_table(filepath, self.action_size)
        self.q_table = q_table
        if epsilon is not None:
            self.epsilon = epsilon
        return map_data

    def reset_memory(self):
        self.q_table = build_q_table(self.action_size)
        self.epsilon = self.config.epsilon
