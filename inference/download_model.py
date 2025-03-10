# ---
# args: ["--force-download"]
# ---

import modal

MODELS_DIR = "/flan-t5"

#neuralmagic/Meta-Llama-3.1-8B-Instruct-quantized.w4a16
#neuralmagic/Meta-Llama-3.1-70B-Instruct-FP8
DEFAULT_NAME = "nvidia/Llama-3.1-Nemotron-70B-Instruct-HF"
DEFAULT_REVISION = "a7c09948d9a632c2c840722f519672cd94af885d"

volume = modal.Volume.from_name("nvidia", create_if_missing=True)

image = (
    modal.Image.debian_slim(python_version="3.10")
    .pip_install(
        [
            "huggingface_hub",  # download models from the Hugging Face Hub
            "hf-transfer",  # download models faster with Rust
        ]
    )
    .env({"HF_HUB_ENABLE_HF_TRANSFER": "1"})
)


MINUTES = 60
HOURS = 60 * MINUTES


app = modal.App(
    image=image,
    secrets=[  # add a Hugging Face Secret if you need to download a gated model
        modal.Secret.from_name("huggingface-secret", required_keys=["HF_TOKEN"])
    ],
)

@app.function(volumes={MODELS_DIR: volume}, timeout=4 * HOURS)
def download_model(model_name, model_revision, force_download=False):
    from huggingface_hub import snapshot_download

    volume.reload()
    
    print(f"Downloading model {model_name} revision {model_revision} to {MODELS_DIR} with force_download={force_download}")

    snapshot_download(
        model_name,
        local_dir=MODELS_DIR + "/" + model_name,
        ignore_patterns=[
            "*.pt",
            "*.bin",
            "*.pth",
            "original/*",
        ],  # Ensure safetensors
        force_download=force_download,
    )

    volume.commit()


@app.local_entrypoint()
def main(
    model_name: str = DEFAULT_NAME,
    model_revision: str = DEFAULT_REVISION,
    force_download: bool = False,
):
    download_model.remote(model_name, model_revision, force_download)