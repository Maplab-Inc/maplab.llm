import json
import os, getpass

from flask import Flask, jsonify, request

from langchain_openai import ChatOpenAI
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

_set_env("OPENAI_API_KEY")
_set_env("MAPLAB_API_KEY")

tools = [optimize_routes, direction, isochrone, matrix, overpass, get_local_endpoint_schema]
# fine-tuned 4o-mini id: ft:gpt-4o-mini-2024-07-18:maplab::AdljqShw
# fine-tuned 4o id: ft:gpt-4o-2024-08-06:maplab::AfGjkfSB
llm = ChatOpenAI(model="ft:gpt-4o-2024-08-06:maplab::AfGjkfSB")

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
    #return {"message":"Deliveries have been optimized: Vehicle 1 delivers to customer at -73.7986, 45.5046; Vehicle 2 delivers to customer at -73.6095, 45.6200; Vehicle 4 delivers to customer at -73.6355, 45.4507. Total distance covered: 50,121 meters.","data":{"vehicleRoutes":[{"vehicleId":1,"visits":[{"order":0,"nodeIndex":6,"nodeId":55474,"nodeLocation":{"longitude":-73.79861343871389,"latitude":45.504563581701404},"loadsOnVisit":[{"productId":1,"quantity":-1000},{"productId":2,"quantity":0}],"distanceFromLastNode":22436}],"totalRouteDistance":22436,"totalRouteLoads":[{"productId":1,"quantity":-1000},{"productId":2,"quantity":0}]},{"vehicleId":2,"visits":[{"order":0,"nodeIndex":4,"nodeId":11474,"nodeLocation":{"longitude":-73.60950763800484,"latitude":45.61997845928107},"loadsOnVisit":[{"productId":1,"quantity":-4500},{"productId":3,"quantity":-8000}],"distanceFromLastNode":16557}],"totalRouteDistance":16557,"totalRouteLoads":[{"productId":1,"quantity":-4500},{"productId":3,"quantity":-8000}]},{"vehicleId":3,"visits":[],"totalRouteDistance":0,"totalRouteLoads":[{"productId":1,"quantity":0},{"productId":2,"quantity":0}]},{"vehicleId":4,"visits":[{"order":0,"nodeIndex":5,"nodeId":55474,"nodeLocation":{"longitude":-73.63554749793641,"latitude":45.45069012897066},"loadsOnVisit":[{"productId":1,"quantity":-9900},{"productId":2,"quantity":-4000},{"productId":3,"quantity":-5000}],"distanceFromLastNode":11128}],"totalRouteDistance":11128,"totalRouteLoads":[{"productId":1,"quantity":-9900},{"productId":2,"quantity":-4000},{"productId":3,"quantity":-5000}]}],"totalDistance":50121,"totalLoads":[{"productId":1,"quantity":-15400},{"productId":2,"quantity":-4000},{"productId":3,"quantity":-13000}],"objective":4648504,"droppedOrders":[]},"type":"json"}
    userContent = request.json.get('user') 
    if not userContent: 
        return jsonify({"error": "Content is required"}), 400
    
    messages = [HumanMessage(content=userContent)]
    
    sysContent = request.json.get('system')
    if sysContent:
        messages.append(SystemMessage(content=sysContent))
    
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