import json
import random
import re

# Dictionary mapping placeholders to their corresponding value lists
PLACEHOLDER_VALUES = {
    "CITY": ["New York", "Los Angeles", "Chicago", "Houston", "Miami", "San Francisco", "Seattle", "Denver", "Boston", "Austin"],
    "COUNTRY": ["USA", "Canada", "Germany", "France", "UK", "Australia", "Japan", "India", "Brazil", "South Africa"],
    "ROAD": ["Main Street", "Broadway", "Sunset Boulevard", "Wall Street", "Fifth Avenue", "Market Street", "Highway 1", "Elm Street", "Park Avenue", "Ocean Drive"],
    "AIRPORT": ["JFK International Airport", "LAX", "O'Hare International Airport", "Dallas/Fort Worth International Airport", "Miami International Airport", "San Francisco International Airport", "Seattle-Tacoma International Airport", "Denver International Airport", "Boston Logan International Airport", "Austin-Bergstrom International Airport"]
}

def replace_placeholders(text, placeholder_values):
    """Replaces placeholders in the given text with values from the provided dictionary."""
    def replacement(match):
        key = match.group(1)
        if key not in placeholder_values:
            raise ValueError(f"Unknown placeholder: %%{key}%%")
        return placeholder_values[key]
    
    return re.sub(r"%%(.*?)%%", replacement, text)

def generate_mutations(template, mutation_count):
    """Generates multiple variations of a template replacing placeholders dynamically without repeating values."""
    generated_samples = []
    used_values = {key: set() for key in PLACEHOLDER_VALUES.keys()}
    
    for i in range(1, mutation_count + 1):
        new_item = template.copy()
        new_item["id"] = f"{template['id']}-{i}"
        
        # Generate unique placeholder values for this mutation
        placeholder_values = {}
        for key, values in PLACEHOLDER_VALUES.items():
            available_choices = list(set(values) - used_values[key])
            if not available_choices:
                raise ValueError(f"Not enough unique values for placeholder %%{key}%%")
            selected_value = random.choice(available_choices)
            used_values[key].add(selected_value)
            placeholder_values[key] = selected_value
        
        new_item["prompt"] = replace_placeholders(new_item["prompt"], placeholder_values)
        new_item["completion"] = replace_placeholders(new_item["completion"], placeholder_values)
        
        generated_samples.append(new_item)
    
    return generated_samples

# Load the preset data
with open('./fine-tuning/dataset/presets/train-overpass.json', 'r') as f:
    data = json.load(f)

# Process the data
final_data = []
for item in data:
    mutation_count = int(item.get("mutation", 1))
    final_data.extend(generate_mutations(item, mutation_count))

# Save the expanded dataset in JSONL format
with open('./fine-tuning/dataset/train/train.jsonl', 'w') as f:
    for entry in final_data:
        json.dump(entry, f)
        f.write('\n')

print(f"Generated {len(final_data)} training examples.")
