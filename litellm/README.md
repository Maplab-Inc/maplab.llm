# LiteLLM Proxy

This directory contains the configuration and tooling to run a [LiteLLM](https://github.com/BerriAI/litellm) proxy server that provides a unified OpenAI-compatible API over multiple LLM backends.

## Files

| File | Description |
|------|-------------|
| `config.yml` | LiteLLM model list and general settings |
| `docker-compose.yml` | Docker Compose stack (LiteLLM + Prometheus) |
| `prometheus.yml` | Prometheus scrape configuration |
| `test_litellm_call.py` | Smoke-test script to validate the proxy |

## Configuration

Models and credentials are defined in `config.yml`. Secrets are injected at runtime via environment variables (see `.env`).

Required environment variables:

| Variable | Description |
|----------|-------------|
| `FOUNDRY_API_BASE` | Base URL of the upstream LLM API |
| `FOUNDRY_API_KEY` | API key for the upstream LLM API |
| `LITELLM_MASTER_KEY` | Master key used to authenticate requests to the proxy |
| `DATABASE_URL` | PostgreSQL connection string for LiteLLM's internal database |

## Running locally

```bash
# Copy and fill in the required secrets
cp .env.example .env

# Start the proxy and Prometheus
docker compose up -d
```

The proxy will be available at `http://localhost:4000` and Prometheus at `http://localhost:9090`.

## Testing

Run the smoke-test script against a running proxy:

```bash
python test_litellm_call.py
```

The script sends a simple chat completion request and prints the model routing headers returned by LiteLLM.

## Kubernetes

Helm charts for deploying LiteLLM to Kubernetes are located in [`../k8s/litellm/`](../k8s/litellm/).
