import modal
from datasets import load_dataset
from pathlib import Path
import torch
import numpy as np
from accelerate.test_utils.testing import get_backend
from transformers import (
    AutoModelForSeq2SeqLM,
    AutoTokenizer,
    DataCollatorForSeq2Seq,
    Seq2SeqTrainer,
    Seq2SeqTrainingArguments,
)

BASE_MODEL = "google/flan-t5-large"

VOL_MOUNT_PATH = Path("/vol")
output_vol = modal.Volume.from_name("finetune-volume-t5", create_if_missing=True)

restart_tracker_dict = modal.Dict.from_name(
    "finetune-restart-tracker-t5", create_if_missing=True
)

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

num_train_epochs: int = 1
size_percentage: int = 1
restarts = track_restarts(restart_tracker_dict)
# Use size percentage to retrieve subset of the dataset to iterate faster
if size_percentage:
    xsum_train = load_dataset("xsum", split=f"train[:{size_percentage}%]", trust_remote_code=True)
    xsum_test = load_dataset("xsum", split=f"test[:{size_percentage}%]", trust_remote_code=True)
# Load the whole dataset
else:
    xsum = load_dataset("xsum")
    xsum_train = xsum["train"]
    xsum_test = xsum["test"]
# Load the tokenizer and model
tokenizer = AutoTokenizer.from_pretrained(BASE_MODEL)
model = AutoModelForSeq2SeqLM.from_pretrained(BASE_MODEL)
# Replace all padding tokens with a large negative number so that the loss function ignores them in
# its calculation
padding_token_id = -100
batch_size = 8
print(f"Padding token: {tokenizer.pad_token}, Padding token ID: {tokenizer.pad_token_id}")
print(f"Vocab Size: {tokenizer.vocab_size}")
print(f"Is 128004 in vocab?: {128004 in tokenizer.get_vocab().values()}")
print(f"Tokenizing geocodeArea:")
print(tokenizer.tokenize("geocodeArea"))
print(tokenizer.encode("geocodeArea"))

def preprocess(batch):
    # prepend summarize: prefix to document to convert the example to a summarization instruction
    inputs = ["summarize: " + doc for doc in batch["document"]]
    model_inputs = tokenizer(
        inputs, max_length=512, truncation=True, padding="max_length"
    )
    labels = tokenizer(
        text_target=batch["summary"],
        max_length=128,
        truncation=True,
        padding="max_length",
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
tokenized_xsum_train = xsum_train.map(
    preprocess, batched=True, remove_columns=["document", "summary", "id"]
)
tokenized_xsum_test = xsum_test.map(
    preprocess, batched=True, remove_columns=["document", "summary", "id"]
)

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
    predictions_text = [tokenizer.decode(pred, skip_special_tokens=True) for pred in predictions]
    labels_text = [tokenizer.decode(label, skip_special_tokens=True) for label in labels]
    
    # Print predictions and labels
    for i in range(len(predictions_text)):
        print(f"✅ Prediction {i}: {predictions_text[i]}")
        print(f"✅ Label {i}: {labels_text[i]}")
        print("-" * 50)
        
    # Debug: Print model's predictions and compare it to model's generate output
    DEVICE, _, _ = get_backend() 
    test_inputs = tokenizer(["Generate an Overpass Turbo query to find all basketball courts in Montreal."], return_tensors="pt").to(DEVICE)
    test_output_ids = model.generate(**test_inputs)
    test_output_text = [tokenizer.decode(output, skip_special_tokens=True) for output in test_output_ids]
    for i in range(len(test_output_text)):
        print(f"Generate prediction {i}: {test_output_text[i]}")
        print("*" * 50)
        
    # Compute metrics
    exact_matches = sum([pred == ref for pred, ref in zip(predictions_text, labels_text)])
    em_score = exact_matches / len(labels_text) if len(labels_text) > 0 else 0
    return {"eval_exact_match": em_score}

data_collator = DataCollatorForSeq2Seq(
    tokenizer,
    model=model,
    label_pad_token_id=padding_token_id,
    pad_to_multiple_of=batch_size,
)
training_args = Seq2SeqTrainingArguments(
    # Save checkpoints to the mounted volume
    output_dir=str(VOL_MOUNT_PATH / "model"),
    per_device_train_batch_size=batch_size,
    per_device_eval_batch_size=batch_size,
    predict_with_generate=True,
    learning_rate=3e-5,
    num_train_epochs=num_train_epochs,
    logging_strategy="steps",
    logging_steps=100,
    eval_strategy="steps",
    save_strategy="steps",
    save_steps=100,
    save_total_limit=2,
    load_best_model_at_end=True,
    metric_for_best_model="exact_match",
)
trainer = Seq2SeqTrainer(
    model=model,
    args=training_args,
    data_collator=data_collator,
    train_dataset=tokenized_xsum_train,
    eval_dataset=tokenized_xsum_test,
    compute_metrics=compute_metrics
)
try:
    resume = restarts > 0
    if resume:
        print("resuming from checkpoint")
    trainer.train(resume_from_checkpoint=False)
except KeyboardInterrupt:  # handle possible preemption
    print("received interrupt; saving state and model")
    trainer.save_state()
    trainer.save_model()
    raise
# Save the trained model and tokenizer to the mounted volume
model.save_pretrained(str(VOL_MOUNT_PATH / "model"))
tokenizer.save_pretrained(str(VOL_MOUNT_PATH / "tokenizer"))
output_vol.commit()
print("✅ done")

