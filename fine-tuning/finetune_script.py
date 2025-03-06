import time
import modal
import torch
from pathlib import Path
from datasets import load_dataset
from peft import LoraConfig, get_peft_model, PeftModel, PeftConfig
from accelerate.test_utils.testing import get_backend
import numpy as np
from transformers import (
    AutoModelForCausalLM,
    LlamaForCausalLM,
    TrainingArguments,
    Trainer,
    DataCollatorForSeq2Seq,
    AutoTokenizer)

VOL_MOUNT_PATH = Path("/vol")
MODEL_NAME = "llama-70B"
FINETUNED_MODEL_NAME = "llama-70B-finetuned"
MODELS_DIR = f"/{MODEL_NAME}"
BASE_MODEL = f"{MODELS_DIR}/meta-llama/Llama-3.3-70B-Instruct"
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

epochs: int = 40
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
    split_data = dataset["train"].train_test_split(test_size=2, train_size=5, seed=42)
    op_train = split_data["train"]
    op_test = split_data["test"]
    
print(op_train)
print(op_test)
    
# Load the tokenizer and model
tokenizer = AutoTokenizer.from_pretrained(BASE_MODEL)
model =  LlamaForCausalLM.from_pretrained(
    BASE_MODEL, 
    use_safetensors=True,
    torch_dtype=torch.bfloat16)

config = LoraConfig(
    r=1,
    lora_alpha=16,
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
print(f"Padding token: {tokenizer.pad_token}, Padding token ID: {tokenizer.pad_token_id}")
print(f"Vocab Size: {tokenizer.vocab_size}")
print(f"Is 128004 in vocab?: {128004 in tokenizer.get_vocab().values()}")
print(f"Tokenizing geocodeArea:")
print(tokenizer.tokenize("geocodeArea"))
print(tokenizer.encode("geocodeArea"))

# DEVICE, _, _ = get_backend() 
# test_inputs = tokenizer(["Generate an Overpass Turbo query to find all basketball courts in Montreal."], return_tensors="pt").to('cpu')
# test_output_ids = model.generate(**test_inputs)
# test_output_text = [tokenizer.decode(output, skip_special_tokens=True) for output in test_output_ids]
# for i in range(len(test_output_text)):
#     print(f"✅ test prediction {i}: {test_output_text[i]}")
#     print("-" * 50)

def preprocess(batch):
    inputs = [
        f"Using this data {batch['system'][i]}, generate overpass turbo query: {batch['prompt'][i]}"
        if batch['system'][i] else f"Generate overpass turbo query: {batch['prompt'][i]}"
        for i in range(len(batch['prompt']))
    ]
    
    #print first input
    # print(inputs[0])
    # print(batch["completion"][0])
    # print(tokenizer.tokenize(batch["completion"][0]))
    # print(tokenizer(batch["completion"][0]))
    
    model_inputs = tokenizer(
        inputs,
        text_target=batch["completion"],
        padding="max_length",
        max_length=256, 
    )
    # labels = tokenizer(
    #     text_target=batch["completion"],
    #     padding="max_length",
    #     max_length=512, 
    # )
    # labels["input_ids"] = [
    #     [
    #         l if l != tokenizer.pad_token_id else padding_token_id
    #         for l in label
    #     ]
    #     for label in labels["input_ids"]
    # ]
    # model_inputs["labels"] = labels
    return model_inputs

tokenized_op_train = op_train.map(
    preprocess, batched=True, remove_columns=op_train.column_names)
tokenized_op_test = op_test.map(
    preprocess, batched=True, remove_columns=op_test.column_names)

def compute_metrics(eval_pred):
    logits, labels = eval_pred
    
    # Convert logits to token IDs
    predictions = np.argmax(logits, axis=-1)
    
    # Debug: Check raw logits and token IDs
    print("Raw Logits:", logits.shape)
    print("Predictions Token IDs:", predictions)
    
    # Remove ignored index (-128004) from labels
    labels = [[token for token in label if token != -128004] for label in labels]

    # Convert token IDs back to text
    predictions_text = [tokenizer.decode(pred, skip_special_tokens=True) for pred in output_ids]
    labels_text = [tokenizer.decode(label, skip_special_tokens=True) for label in labels]
    
    test_inputs = tokenizer(["Generate an Overpass Turbo query to find all basketball courts in Montreal."], return_tensors="pt").to('cpu')
    test_output_ids = model.generate(**test_inputs)
    test_output_text = [tokenizer.decode(output, skip_special_tokens=True) for output in test_output_ids]
    for i in range(len(test_output_text)):
        print(f"✅ test prediction {i}: {test_output_text[i]}")
        print("*" * 50)

    # Debug: Print first 5 examples
    for i in range(len(predictions_text)):
        print(f"✅ Prediction {i}: {predictions_text[i]}")
        print(f"✅ Label {i}: {labels_text[i]}")
        print("-" * 50)

    # Compute Exact Match
    exact_matches = sum([pred == ref for pred, ref in zip(predictions_text, labels_text)])
    em_score = exact_matches / len(labels_text) if len(labels_text) > 0 else 0

    return {"eval_exact_match": em_score}


data_collator = DataCollatorForSeq2Seq(
    tokenizer,
    model=model
)

# test data collator 
batch = data_collator([tokenized_op_train[i] for i in range(1, 3)])
print(batch.keys())
print(batch["input_ids"])

# Print results
for i, text in enumerate(output_text):
    print(f"Generated Output with collator {i}: {text}")


training_args = TrainingArguments(
    num_train_epochs = epochs,
    output_dir=str(VOL_MOUNT_PATH / "model"),
    logging_dir=str(VOL_MOUNT_PATH / "logs"),
    metric_for_best_model="exact_match",
    logging_strategy="steps",
    logging_steps=10,
    eval_strategy="steps",
    save_strategy="steps",
    save_steps=100,
    save_total_limit=2,
    bf16=True,
    learning_rate=3e-5,
    per_device_train_batch_size=1,
    per_device_eval_batch_size=1,
    gradient_accumulation_steps=8,
    gradient_checkpointing=True,
    label_names=["labels"]
)

trainer = Trainer(
    model=model,
    args=training_args,
    data_collator=data_collator,
    train_dataset=tokenized_op_train,
    eval_dataset=tokenized_op_test,
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