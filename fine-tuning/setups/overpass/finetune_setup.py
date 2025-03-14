import modal
from pathlib import Path

image = modal.Image.from_registry("ubuntu:22.04", add_python="3.11").apt_install(
    "ca-certificates",
    "gcc"
).pip_install(
    "unsloth",
    "accelerate",
    "transformers",
    "torch",
    "datasets",
    "tensorboard",
    "peft",
    "evaluate",
    "trl"
)

VOL_MOUNT_PATH = Path("/vol")
MODELS_DIR = "/llama-70B"
app = modal.App(name="trainer", image=image)
output_vol = modal.Volume.from_name("finetune-volume-large", create_if_missing=True)
model_vol = modal.Volume.lookup("llama-70B", create_if_missing=False)

@app.function(
    gpu="H100:2",
    timeout=72000,
    volumes={VOL_MOUNT_PATH: output_vol, MODELS_DIR: model_vol},
    mounts=[modal.Mount.from_local_dir("./", remote_path="/root/")]
)
def training():
    import subprocess
    config_file_path = "/root/fsdp_config.yaml"
    script_name = "/root/finetune_script.py"
    
    command = [
        "accelerate", "launch",
        f"--config_file={config_file_path}",
        script_name,
        "--multi_gpu=true",
        "--bf16"
    ]
    
    # Run without accelerate
    # command = [
    #     "python", script_name
    # ]
    
    try:
        subprocess.run(command, check=True)
        print("Accelerate command executed successfully!")
    except subprocess.CalledProcessError as e:
        print(f"Error while executing accelerate command: {e}")

@app.function(volumes={VOL_MOUNT_PATH: output_vol})
@modal.wsgi_app()
def monitor():
    import tensorboard

    board = tensorboard.program.TensorBoard()
    board.configure(logdir=f"{VOL_MOUNT_PATH}/logs")
    (data_provider, deprecated_multiplexer) = board._make_data_provider()
    wsgi_app = tensorboard.backend.application.TensorBoardWSGIApp(
        board.flags,
        board.plugin_loaders,
        data_provider,
        board.assets_zip_provider,
        deprecated_multiplexer,
    )
    return wsgi_app