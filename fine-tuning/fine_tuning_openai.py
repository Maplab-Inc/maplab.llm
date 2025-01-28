import json
import os
from openai import OpenAI

API_KEY = "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"

client = OpenAI(
  organization='org-DANFsBVtMnhhgGCDDnoj3XeQ',
  project='proj_2KNhdygsu2Va5fpTlDLiFaYB',
  api_key=API_KEY
)
system_file_path = os.path.join(os.getcwd(), 'fine-tuning', 'dataset', 'system.txt')
with open(system_file_path, "r") as file:
    system_message = file.read()
    
training_data = []
training_file_path = os.path.join(os.getcwd(), 'fine-tuning', 'dataset', 'training.jsonl')
with open(training_file_path, 'r') as file:
    for line in file:
        data = json.loads(line)
        
        for message in data['messages']:
            if message['role'] == 'system':
                message['content'] = system_message
                break
        
        training_data.append(data)
        
temp_training_file_name = "temp-training-data.jsonl"
with open(temp_training_file_name, "w") as file:
    for item in training_data: 
        file.write(json.dumps(item) + "\n")
    
current_training_files = client.files.list()
for file in current_training_files.data:
    if file.purpose == 'fine-tune':
        client.files.delete(file.id)
    
file_upload_response = client.files.create(
    file=open(temp_training_file_name, "rb"),
    purpose="fine-tune"
)

client.fine_tuning.jobs.create(
training_file=file_upload_response.id,
model="gpt-4o-2024-08-06",
)

os.remove(temp_training_file_name)


    