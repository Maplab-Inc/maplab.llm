import modal
from pathlib import Path

image = modal.Image.from_registry("ubuntu:22.04", add_python="3.11").apt_install(
    "ca-certificates"
).pip_install(
    "accelerate",
    "transformers",
    "torch",
    "datasets",
    "tensorboard",
    "peft"
)

VOL_MOUNT_PATH = Path("/vol")
MODELS_DIR = "/llama-8B-wattai"
BASE_MODEL = f"{MODELS_DIR}/watt-ai/watt-tool-8B"

app = modal.App(name="overpass-trainer", image=image)
output_vol = modal.Volume.from_name("finetune-volume", create_if_missing=True)
model_vol = modal.Volume.lookup("llama-8B-wattai", create_if_missing=False)

@app.function(
    gpu=modal.gpu.A10G(count=2),
    #memory=85900,
    timeout=7200,
    volumes={VOL_MOUNT_PATH: output_vol, MODELS_DIR: model_vol},
    mounts=[modal.Mount.from_local_dir("./", remote_path="/root/")]
)
def setup():
    import subprocess
    # Define your config file path and script name
    config_file_path = "/root/fsdp_config.yaml"
    script_name = "/root/finetune_script.py"
    
    # Build the command as a list
    command = [
        "accelerate", "launch",
        f"--config_file={config_file_path}",
        script_name,
        "--multi_gpu=true"
        "--bf16"
    ]
    
    # Execute the command
    try:
        subprocess.run(command, check=True)
        # with output_vol.batch_upload(force=True) as batch:
        #     batch.put_file("config.json", "llama-8B-wattai/config.json")
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
