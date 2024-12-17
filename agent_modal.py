import os, getpass

from flask import Flask, jsonify, request


from langchain_openai import ChatOpenAI
from langgraph.graph import MessagesState
from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.graph import START, StateGraph
from langgraph.prebuilt import tools_condition
from langgraph.prebuilt import ToolNode
from langchain_community.llms import Modal
from langchain.chains import LLMChain
from langchain_core.prompts import PromptTemplate

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

_set_env("OPENAI_API_KEY")
_set_env("MAPLAB_API_KEY")

# fine-tuned 4o-mini id: ft:gpt-4o-mini-2024-07-18:maplab::AdljqShw
# fine-tuned 4o id: ft:gpt-4o-2024-08-06:maplab::AdrJCNPA
tools = [optimize_routes, direction, isochrone, matrix, overpass, get_local_endpoint_schema]
llm = ChatOpenAI(model="ft:gpt-4o-2024-08-06:maplab::AdrJCNPA")
llm_with_tools = llm.bind_tools(tools, parallel_tool_calls=False)
# modal_llama_8b_endpoint = "https://maplab--example-vllm-openai-compatible-serve.modal.run/v1/chat/completions"
# llm = Modal(endpoint_url=modal_llama_8b_endpoint)

# template = """Question: {question}
# Answer: Let's think step by step."""
# prompt = PromptTemplate.from_template(template)
# llm_chain = LLMChain(prompt=prompt, llm=llm)
# question = "What NFL team won the Super Bowl in the year Justin Beiber was born?"
# llm_chain.run(question)
# llm_with_tools = llm | tools 

sys_msg = SystemMessage(content=get_assistant_guidelines())

def assistant(state: MessagesState):
   return {"messages": [llm.invoke([sys_msg] + state["messages"])]}

builder = StateGraph(MessagesState)

builder.add_node("assistant", assistant)
builder.add_node("tools", ToolNode(tools))

builder.add_edge(START, "assistant")
builder.add_conditional_edges(
    "assistant",
    # If the latest message (result) from assistant is a stool call -> tools_condition routes to tools
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
    
    return jsonify(result[-1])

if __name__ == '__main__': 
    app.run(debug=True)