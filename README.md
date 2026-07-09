# maplab.llm

AI-powered assistant for map and GIS operations — route optimization, directions, isochrones, matrix calculations, and Overpass queries. Built on LangGraph with an OpenAI backend and served through a LiteLLM proxy.

## Repository structure

| Directory | Description |
|-----------|-------------|
| [`agent.py`](agent.py) / [`agent_modal.py`](agent_modal.py) | Flask API exposing the LangGraph ReAct agent |
| [`tools/`](tools/) | Individual tool implementations (directions, isochrone, matrix, overpass, route optimization) |
| [`helpers/`](helpers/) | Utilities for OpenAPI schema loading and system prompt generation |
| [`langgraph/`](langgraph/) | Standalone LangGraph ReAct agent package (LangGraph Studio compatible) |
| [`litellm/`](litellm/) | LiteLLM proxy configuration and Docker Compose stack |
| [`maplab-chat/`](maplab-chat/) | Nx monorepo for the front-end chat application |
| [`fine-tuning/`](fine-tuning/) | Dataset creation and fine-tuning scripts (OpenAI) |
| [`inference/`](inference/) | vLLM inference server scripts for self-hosted models |
| [`k8s/`](k8s/) | Helm charts for deploying LiteLLM to Kubernetes |
| [`benchmarks/`](benchmarks/) | LLM benchmarking and streaming tests |

## Getting started

### Prerequisites

- Python 3.11+
- Docker & Docker Compose (for the LiteLLM proxy)
- Node.js 18+ (for the front-end)

### Agent (Flask API)

```bash
pip install -r requirements.txt
OPENAI_API_KEY=<key> MAPLAB_API_KEY=<key> python agent.py
```

### LiteLLM proxy

```bash
cd litellm
cp .env.example .env   # fill in credentials
docker compose up -d
```

See [`litellm/README.md`](litellm/README.md) for full configuration details.

### Front-end

```bash
cd maplab-chat
npm install
npx nx serve maplab-chat
```

## Tools

The agent has access to the following GIS tools:

| Tool | Description |
|------|-------------|
| `direction` | Turn-by-turn routing between coordinates |
| `isochrone` | Reachability polygons from a point |
| `matrix` | Travel-time/distance matrix between multiple points |
| `overpass` | OpenStreetMap data queries via the Overpass API |
| `optimize_routes` | Vehicle route optimization (VRP) |
| `get_local_endpoint_schema` | Introspect OpenAPI schemas for available endpoints |

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | Yes | OpenAI API key |
| `MAPLAB_API_KEY` | Yes | Maplab services API key |
| `LITELLM_API_KEY` | For proxy | Key to authenticate against the LiteLLM proxy |
| `LITELLM_BASE_URL` | For proxy | Base URL of the LiteLLM proxy |
