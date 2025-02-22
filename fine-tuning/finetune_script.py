import time
import modal
import torch
from pathlib import Path
from datasets import load_dataset
from peft import LoraConfig, get_peft_model, PeftModel, PeftConfig
from transformers import (
    AutoModelForCausalLM,
    LlamaForCausalLM,
    TrainingArguments,
    Trainer,
    DataCollatorForSeq2Seq,
    AutoTokenizer)

VOL_MOUNT_PATH = Path("/vol")
MODEL_NAME = "llama-8B-wattai"
FINETUNED_MODEL_NAME = "llama-8B-wattai-finetuned"
MODELS_DIR = f"/{MODEL_NAME}"
BASE_MODEL = f"{MODELS_DIR}/watt-ai/watt-tool-8B"
output_vol = modal.Volume.from_name("finetune-volume", create_if_missing=True)

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
    op = load_dataset("Maplabai/finetuning")
    split_data = op["train"].train_test_split(test_size=2, train_size=5, seed=42)
    op_train = split_data["train"]
    op_test = split_data["test"]
    
# Load the tokenizer and model
tokenizer = AutoTokenizer.from_pretrained(BASE_MODEL)
model =  LlamaForCausalLM.from_pretrained(
    BASE_MODEL, 
    use_safetensors=True,
    torch_dtype=torch.bfloat16,
    device_map="cpu")

config = LoraConfig(
    r=32,
    lora_alpha=32,
    target_modules=["q_proj", "v_proj"],
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
# Replace all padding tokens with a large negative number so that the loss function ignores them in
# its calculation
padding_token_id = -100
batch_size = 1
def preprocess(batch):
    inputs = [
    f"{batch['system'][i]} {batch['prompt'][i]}" if batch['system'][i] else batch['prompt'][i]
    for i in range(len(batch['system']))
    ]
    #print first 10 inputs
    print(inputs[:10])
    print(batch["completion"][:10])
    
    model_inputs = tokenizer(
        inputs,
        padding="max_length",
        max_length=512, 
    )
    labels = tokenizer(
        text_target=batch["completion"],
        padding="max_length",
        max_length=512, 
    )
    labels["input_ids"] = [
        [
            l if l != tokenizer.pad_token_id else padding_token_id
            for l in label
        ]
        for label in labels["input_ids"]
    ]
    model_inputs["labels"] = labels["input_ids"]
    return model_inputs
tokenized_op_train = op_train.map(
    preprocess, batched=True, remove_columns=["system", "prompt", "completion", "id"]
)
tokenized_op_test = op_test.map(
    preprocess, batched=True, remove_columns=["system", "prompt", "completion", "id"]
)

data_collator = DataCollatorForSeq2Seq(
    tokenizer,
    model=model,
    label_pad_token_id=padding_token_id,
    pad_to_multiple_of=batch_size,
)

training_args = TrainingArguments(
    num_train_epochs = epochs,
    output_dir=str(VOL_MOUNT_PATH / "model"),
    logging_dir=str(VOL_MOUNT_PATH / "logs"),
    logging_strategy="steps",
    logging_steps=10,
    evaluation_strategy="steps",
    save_strategy="steps",
    save_steps=100,
    save_total_limit=2,
    bf16=True,
    learning_rate=3e-5,
    per_device_train_batch_size=1,
    per_device_eval_batch_size=1,
    gradient_accumulation_steps=8,
    gradient_checkpointing=True
)

trainer = Trainer(
    model=model,
    args=training_args,
    data_collator=data_collator,
    train_dataset=tokenized_op_train,
    eval_dataset=tokenized_op_test,
)

#Evaluate before training
#print("Evaluating model before training...")
#eval_results_before = trainer.evaluate()
#print(f"Pre-training evaluation results: {eval_results_before}")

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
tokenizer.save_pretrained(str(VOL_MOUNT_PATH / FINETUNED_MODEL_NAME))
output_vol.commit()

# Merge the model and save it to the mounted volume
peft_config = PeftConfig.from_pretrained(str(VOL_MOUNT_PATH / MODEL_NAME))
original_model = AutoModelForCausalLM.from_pretrained(
    peft_config.base_model_name_or_path, 
    torch_dtype=torch.bfloat16,
    device_map="cpu")
lora_model = PeftModel.from_pretrained(
    original_model, 
    str(VOL_MOUNT_PATH / MODEL_NAME),
    torch_dtype=torch.float16,
    device_map="cpu")
merged_model = lora_model.merge_and_unload()
merged_model.save_pretrained(str(VOL_MOUNT_PATH / FINETUNED_MODEL_NAME))
output_vol.commit()

end_time = time.time()
total_time = end_time - start_time
hours = total_time // 3600
minutes = (total_time % 3600) // 60
seconds = total_time % 60
print(f"✅ Done training!")
print(f"Total training time: {int(hours)} hours, {int(minutes)} minutes, and {int(seconds)} seconds")
eval_results = trainer.evaluate()
print(f"Final evaluation results: {eval_results}")