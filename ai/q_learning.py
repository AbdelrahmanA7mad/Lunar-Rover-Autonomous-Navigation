import numpy as np
import random
from collections import defaultdict
import json
import os

class QLearningAgent:
    def __init__(self, state_size, action_size, lr=0.1, gamma=0.99, epsilon=1.0, epsilon_decay=0.995, min_epsilon=0.01):
        self.state_size = state_size
        self.action_size = action_size
        self.lr = lr
        self.gamma = gamma
        self.epsilon = epsilon
        self.epsilon_decay = epsilon_decay
        self.min_epsilon = min_epsilon
        
        # State can be complex (dict), so we will hash it into a string
        self.Q = defaultdict(lambda: np.zeros(action_size))
        
    def _get_state_key(self, state):
        """Convert state dict to a hashable string representation"""
        rover_pos = f"{state['rover'][0]},{state['rover'][1]}"
        target_pos = f"{state['target'][0]},{state['target'][1]}"
        # For a simple Q-learning, we might simplify the state space by focusing only on rover, target and immediately surrounding rocks/craters
        # To keep it manageable, let's just use rover and target positions for this basic implementation.
        # Ideally, we should include the grid, but that would make the state space huge.
        return f"{rover_pos}|{target_pos}"

    def choose_action(self, state):
        state_key = self._get_state_key(state)
        if random.random() < self.epsilon:
            return random.randint(0, self.action_size - 1)  # Explore
        else:
            return np.argmax(self.Q[state_key])  # Exploit

    def learn(self, state, action, reward, next_state, done):
        state_key = self._get_state_key(state)
        next_state_key = self._get_state_key(next_state)
        
        target = reward
        if not done:
            target += self.gamma * np.max(self.Q[next_state_key])
            
        self.Q[state_key][action] += self.lr * (target - self.Q[state_key][action])
        
    def update_epsilon(self):
        if self.epsilon > self.min_epsilon:
            self.epsilon *= self.epsilon_decay
            self.epsilon = max(self.min_epsilon, self.epsilon)

    def save(self, filepath, map_data=None):
        q_dict = {k: v.tolist() for k, v in self.Q.items()}
        data = {
            'q_table': q_dict,
            'epsilon': self.epsilon
        }
        if map_data:
            data['map_data'] = map_data
            
        with open(filepath, 'w') as f:
            json.dump(data, f)

    def load(self, filepath):
        if os.path.exists(filepath):
            with open(filepath, 'r') as f:
                data = json.load(f)
                q_dict = data['q_table']
                self.epsilon = data['epsilon']
                self.Q = defaultdict(lambda: np.zeros(self.action_size))
                for k, v in q_dict.items():
                    self.Q[k] = np.array(v)
                return data.get('map_data', None)
        return None
        
    def reset_memory(self):
        """Clear the Q-table when starting a new map"""
        self.Q.clear()
        self.epsilon = 1.0
