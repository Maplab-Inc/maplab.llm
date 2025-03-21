"""Utility & helper functions."""

from langchain.chat_models import init_chat_model
from langchain_core.language_models import BaseChatModel
from langchain_core.messages import BaseMessage
from langchain_openai import ChatOpenAI


def get_message_text(msg: BaseMessage) -> str:
    """Get the text content of a message."""
    content = msg.content
    if isinstance(content, str):
        return content
    elif isinstance(content, dict):
        return content.get("text", "")
    else:
        txts = [c if isinstance(c, str) else (c.get("text") or "") for c in content]
        return "".join(txts).strip()


def load_chat_model(name: str) -> BaseChatModel:
    """Load a chat model from a specified name.

    Args:
        name (str): String to indicate which model to load.
    """

    if (name == "openai"):
        return ChatOpenAI(model="gpt-4o", streaming=True)
    elif (name == "llama"):
        return ChatOpenAI(
            base_url="https://maplab--maplab-vllm-serve.modal.run/v1/",
            model="llama-70B",
            temperature=0.6,
            top_p=0.9)
    elif (name == "overpass"): 
        return ChatOpenAI(
            base_url="https://maplab--maplab-vllm-serve.modal.run/v1/",
            model="overpass",
            temperature=0.6,
            top_p=0.9)
    else: 
        provider, model = name.split("/", maxsplit=1)
        return init_chat_model(model, model_provider=provider)
        
