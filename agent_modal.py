import json
import os, getpass

from flask import Flask, jsonify, request

from langchain_ollama import ChatOllama
from langchain_openai import ChatOpenAI, OpenAI
from langchain_groq import ChatGroq
from langgraph.graph import MessagesState
from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.graph import START, StateGraph
from langgraph.prebuilt import tools_condition
from langgraph.prebuilt import ToolNode

from helpers.openapi_schema_helper import get_local_endpoint_schema
from helpers.system_message_helper import get_assistant_guidelines
from tools.direction_tool import direction
from tools.isochrone_tool import isochrone
from tools.matrix_tool import matrix
from tools.overpass_tool import overpass
from tools.route_optimization_tool import optimize_routes

app = Flask(__name__)

def _set_env(var: str):
    if not os.environ.get(var):
        os.environ[var] = getpass.getpass(f"{var}: ")

_set_env("MAPLAB_API_KEY")

tools = [optimize_routes, direction, isochrone, matrix, overpass]
endpoint="https://maplab--maplab-vllm-serve.modal.run/v1/"
llm = ChatOpenAI(
    base_url=endpoint,
    model="Meta-Llama-3.1-8B-Instruct-quantized.w4a16"
)

llm_with_tools = llm.bind_tools(tools, parallel_tool_calls=False)

sys_msg = SystemMessage(content=get_assistant_guidelines())

def assistant(state: MessagesState):
   return {"messages": [llm_with_tools.invoke([sys_msg] + state["messages"])]}

builder = StateGraph(MessagesState)

builder.add_node("assistant", assistant)
builder.add_node("tools", ToolNode(tools))

builder.add_edge(START, "assistant")
builder.add_conditional_edges(
    "assistant",
    # If the latest message (result) from assistant is a tool call -> tools_condition routes to tools
    # If the latest message (result) from assistant is a not a tool call -> tools_condition routes to END
    tools_condition,
)

builder.add_edge("tools", "assistant")
react_graph = builder.compile()

@app.route('/assistant', methods=['POST']) 
def invoke_assistant(): 
    content = request.json.get('content') 
    if not content: 
        return jsonify({"error": "Content is required"}), 400

    messages = [HumanMessage(content=content)]
    resonse_messages = react_graph.invoke({"messages": messages}, {"recursion_limit": 50})
    
    result = []
    for m in resonse_messages['messages']:
        m.pretty_print()
        if (m.content != ""):
            result.append({
                "response": m.content
            })
    
    response = result[-1]['response']
    return response

if __name__ == '__main__': 
    app.run(debug=True)