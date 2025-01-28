import json
import os

print("Current directory:", os.getcwd())

with open('./fine-tuning/dataset/presets/train-overpass.json', 'r') as f:
    data = json.load(f)

with open('./fine-tuning/dataset/train/train.jsonl', 'w') as f:
    for item in data:
        json.dump(item, f)
        f.write('\n')
