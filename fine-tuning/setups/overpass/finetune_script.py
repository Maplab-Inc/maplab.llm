from unsloth.chat_templates import get_chat_template
import time
import modal
import torch
from pathlib import Path
from datasets import load_dataset
from peft import LoraConfig, get_peft_model, PeftModel, PeftConfig
from accelerate.test_utils.testing import get_backend
from trl import SFTTrainer
import numpy as np
from transformers import (
    LlamaForCausalLM,
    TrainingArguments,
    AutoTokenizer)

VOL_MOUNT_PATH = Path("/vol")
MODEL_NAME = "llama-70B"
MODELS_DIR = f"/{MODEL_NAME}"
BASE_MODEL = f"{MODELS_DIR}/meta-llama/Llama-3.3-70B-Instruct"
output_vol = modal.Volume.from_name("finetune-volume-large", create_if_missing=True)

def track_restarts(restart_tracker: modal.Dict) -> int:
    if not restart_tracker.contains("count"):
        preemption_count = 0
        print(f"Starting first time. {preemption_count=}")
        restart_tracker["count"] = preemption_count
    else:
        preemption_count = restart_tracker.get("count") + 1
        print(f"Restarting after pre-emption. {preemption_count=}")
        restart_tracker["count"] = preemption_count
    return preemption_count

restart_tracker_dict = modal.Dict.from_name(
    "finetune-restart-tracker", create_if_missing=True
)

print(f"GPUs available: {torch.cuda.device_count()}")

epochs: int = 10
size_percentage: int = 0

start_time = time.time()
restarts = track_restarts(restart_tracker_dict)

# Use size percentage to retrieve subset of the dataset to iterate faster
if size_percentage > 0:
    op_train = load_dataset("Maplabai/finetuning", split=f"train[:{size_percentage}%]", trust_remote_code=True)
    op_test = load_dataset("Maplabai/finetuning", split=f"test[:{size_percentage}%]", trust_remote_code=True)
# Load the whole dataset
else:
    dataset = load_dataset("Maplabai/finetuning")
    split_data = dataset["train"].train_test_split(test_size=0.1, train_size=0.9, seed=42)
    op_train = split_data["train"]
    op_test = split_data["test"]
    
# Load the tokenizer and model
model = LlamaForCausalLM.from_pretrained(
    BASE_MODEL, 
    torch_dtype=torch.bfloat16, 
    use_safetensors=True,
    device_map="cpu"
)
tokenizer = AutoTokenizer.from_pretrained(BASE_MODEL)

print(model)

config = LoraConfig(
    r=16,
    lora_alpha=16,
    target_modules=["q_proj", "v_proj",  "k_proj", "o_proj", "down_proj", "up_proj", "gate_proj"],
    lora_dropout=0.1,
    bias="none"
)

model.enable_input_require_grads()
model = get_peft_model(model, config)

trainable_params = 0
all_param = 0
for _, param in model.named_parameters():
    all_param += param.numel()
    if param.requires_grad:
        trainable_params += param.numel()
print(
    f"trainable params: {trainable_params} || all params: {all_param} || trainable%: {100 * trainable_params / all_param:.2f}"
)

print(f"✅ Tokenizer/Model loaded!")

batch_size = 1

tokenizer = get_chat_template(
    tokenizer,
    mapping={"role": "from", "content": "value", "user": "human", "assistant": "gpt"},
    chat_template="chatml",
)

def apply_template(examples):
    messages = []
    for prompt, completion in zip(examples["prompt"], examples["completion"]):
        messages.append([
            {"from": "human", "value": prompt},
            {"from": "gpt", "value": completion}
        ])  
    text = [tokenizer.apply_chat_template(message, tokenize=False, add_generation_prompt=False) for message in messages]
    return {"text": text}

op_train = op_train.map(apply_template, batched=True, remove_columns=op_train.column_names)
op_test = op_test.map(apply_template, batched=True, remove_columns=op_test.column_names)

def compute_metrics(eval_pred):
    logits, labels = eval_pred
    
    # Convert logits to token IDs
    predictions = np.argmax(logits, axis=-1)
    
    # Remove ignored index (-128004) from labels
    print(f"Raw predictions: {predictions}")
    predictions = [[token for token in pred if token != 0] for pred in predictions]
    
    # Convert token IDs back to text
    predictions_text = [tokenizer.decode(pred, skip_special_tokens=True) for pred in predictions]
    labels_text = [tokenizer.decode(label, skip_special_tokens=True) for label in labels]
    
    for i in range(len(predictions_text)):
        print(f"✅ Logit Prediction {i}: {predictions_text[i]}")
        print(f"✅ Label {i}: {labels_text[i]}")
        print("-" * 50)
    
    # Compute metrics
    exact_matches = sum([pred == ref for pred, ref in zip(predictions_text, labels_text)])
    em_score = exact_matches / len(labels_text) if len(labels_text) > 0 else 0

    return {"eval_exact_match": em_score}


print("Example from train_dataset:", op_train)

training_args = TrainingArguments(
    num_train_epochs = epochs,
    output_dir=str(VOL_MOUNT_PATH / "model"),
    logging_dir=str(VOL_MOUNT_PATH / "logs"),
    logging_strategy="steps",
    do_eval=True,
    logging_steps=10,
    eval_strategy="steps",
    save_strategy="steps",
    save_steps=100,
    save_total_limit=2,
    learning_rate=3e-5,
    fp16=False,
    bf16=True,
    per_device_train_batch_size=1,
    per_device_eval_batch_size=1,
    gradient_accumulation_steps=8,
    gradient_checkpointing=True,
    seed=42,
)

trainer = SFTTrainer(
    model=model, 
    tokenizer=tokenizer,
    args=training_args,
    train_dataset=op_train,
    eval_dataset=op_test,
    dataset_text_field="text",
    compute_metrics=compute_metrics
)

try:
    resume = restarts > 1
    if resume:
        print("resuming from checkpoint")
    trainer.train(resume_from_checkpoint=False)
except KeyboardInterrupt:  # handle possible preemption
    print("received interrupt; saving state and model")
    trainer.save_state()
    trainer.save_model()
    raise

# Save the trained adapter and tokenizer to the mounted volume
model.save_pretrained(str(VOL_MOUNT_PATH / MODEL_NAME), safe_serialization=True)
tokenizer.save_pretrained(str(VOL_MOUNT_PATH / MODEL_NAME))
output_vol.commit()

# Merge the model and save it to the mounted volume
# peft_config = PeftConfig.from_pretrained(str(VOL_MOUNT_PATH / MODEL_NAME))
# original_model = AutoModelForCausalLM.from_pretrained(
#     peft_config.base_model_name_or_path, 
#     torch_dtype=torch.bfloat16,
#     device_map="cpu")
# lora_model = PeftModel.from_pretrained(
#     original_model, 
#     str(VOL_MOUNT_PATH / MODEL_NAME),
#     torch_dtype=torch.float16,
#     device_map="cpu")
# merged_model = lora_model.merge_and_unload()
# merged_model.save_pretrained(str(VOL_MOUNT_PATH / FINETUNED_MODEL_NAME))
# output_vol.commit()

end_time = time.time()
total_time = end_time - start_time
hours = total_time // 3600
minutes = (total_time % 3600) // 60
seconds = total_time % 60
print(f"✅ Done training!")
print(f"Total training time: {int(hours)} hours, {int(minutes)} minutes, and {int(seconds)} seconds")
eval_results = trainer.evaluate()
print(f"Final evaluation results: {eval_results}")