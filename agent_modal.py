import os, getpass

from flask import Flask, jsonify, request

from langchain_ollama import ChatOllama
from langchain_openai import ChatOpenAI
from langchain_community.llms import VLLM
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
from flask_cors import CORS


app = Flask(__name__)
CORS(app)

def _set_env(var: str):
    if not os.environ.get(var):
        os.environ[var] = getpass.getpass(f"{var}: ")

_set_env("MAPLAB_API_KEY")

tools = [optimize_routes, direction, isochrone, matrix, overpass, get_local_endpoint_schema]
endpoint="https://maplab--maplab-vllm-serve.modal.run/v1/"
llm = ChatOpenAI(
    base_url=endpoint,
    model="Llama-3.3-70B-Instruct",
    temperature=0.6,
    top_p=0.9)

llm_with_tools = llm.bind_tools(tools)

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
    userContent = request.json.get('user') 
    if not userContent: 
        return jsonify({"error": "Content is required"}), 400
    
    messages = [HumanMessage(content=userContent)]
    
    sysContent = request.json.get('system')
    if sysContent:
        messages.append(SystemMessage(content=sysContent))
    
    resonse_messages = react_graph.invoke({"messages": messages}, {"recursion_limit": 100})
    
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