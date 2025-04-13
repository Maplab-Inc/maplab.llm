from datetime import datetime, timezone
from typing import Dict, List, Literal, cast

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_core.runnables import RunnableConfig
from langgraph.graph import StateGraph
from langgraph.prebuilt import ToolNode

from react_agent.configuration import Configuration
from react_agent.state import InputState, State
from react_agent.tools import ROUTING_TOOLS, QUERY_TOOLS
from react_agent.utils import load_chat_model

from flask import Flask, jsonify, request
from flask_cors import CORS
import requests
import copy
import json
import re
import time


# Define the function that calls the model


async def call_model(
    state: State, config: RunnableConfig
) -> Dict[str, List[AIMessage]]:
    """Call the LLM powering our "agent".

    This function prepares the prompt, initializes the model, and processes the response.

    Args:
        state (State): The current state of the conversation.
        config (RunnableConfig): Configuration for the model run.

    Returns:
        dict: A dictionary containing the model's response message.
    """
    configuration = Configuration.from_runnable_config(config)

    # Initialize the model with tool binding. Change the model or add more tools here.
    model = load_chat_model(configuration.model).bind_tools(ROUTING_TOOLS)

    # Format the system prompt. Customize this to change the agent's behavior.
    # system_message = configuration.system_prompt.format(
    #     system_time=datetime.now(tz=timezone.utc).isoformat()
    # )
    
    system_message = configuration.orchestrator_system_prompt
    
    messages = state.messages[:]
    last_message = copy.deepcopy(messages[-1])
    is_overpass_response = (
        isinstance(last_message, AIMessage) and 
        last_message.additional_kwargs.get("origin") == "overpass"
    )
    
    content_type = ''

    if is_overpass_response and len(last_message.content) > 2000:
        content_type = 'overpass'
        messages[-1].content = "The Overpass response is too large to include directly. It has been saved in memory. Please generate the final response as usual and the Overpass data will be replaced dynamically."
        
    elif last_message.type == 'tool' and last_message.name == 'isochrone' and len(last_message.content) > 2000:
        content_type = 'isochrone'
        messages[-1].content = "The routing response is too large to include directly. It has been saved in memory. Please generate the final response as usual and the Isochrone data will be added dynamically."
        
    elif last_message.type == 'tool' and last_message.name == 'optimize_routes' and last_message.status == 'success':
        content_type = 'route_optimization'

    # Get the model's response
    response = cast(
        AIMessage,
        await model.ainvoke(
            [{"role": "system", "content": system_message}, *messages], config
        ),
    )

    # Handle the case when it's the last step and the model still wants to use a tool
    if state.is_last_step and response.tool_calls:
        return {
            "messages": [
                AIMessage(
                    id=response.id,
                    content="Sorry, I could not find an answer to your question in the specified number of steps.",
                )
            ]
        }
    
    if (content_type): 
        parsed_data = json.loads(last_message.content)  # Parse to ensure it's valid JSON
        response.content = {
            "message": response.content,
            "data": parsed_data,
            "type": content_type,
        }

    return {"messages": [response]}

async def call_overpass(
    state: State, config: RunnableConfig
) -> Dict[str, List[AIMessage]]:
    """Call the Overpass LLM."""

    configuration = Configuration.from_runnable_config(config)

    # Load Overpass-specific model
    model = load_chat_model(configuration.overpass_model).bind_tools(QUERY_TOOLS)

    system_message = configuration.overpass_system_prompt

    response = cast(
        AIMessage,
        await model.ainvoke(
            [{"role": "system", "content": system_message}, *state.messages], config
        ),
    )

    if state.is_last_step and response.tool_calls:
        return {
            "messages": [
                AIMessage(
                    id=response.id,
                    content="Sorry, I could not find an answer in the given steps.",
                )
            ]
        }
        
    overpass_result = overpass(response.content)
    
    return {
        "messages": [
            AIMessage(
                id=response.id,
                additional_kwargs={"origin": "overpass"},
                content=overpass_result,
            )
        ]
    }

def overpass(overpass_request: str) -> str:
    """
    Overpass Tool for querying and visualizing OpenStreetMap data. It helps extract specific information from the vast OSM database by writing queries in the Overpass QL query language. 
    Args:
        overpass_request: A text string that contains the Overpass QL query. 
    """
    match = re.search(r"{{geocodeArea:(.*?)}}", overpass_request)
    if match:
        area_name = match.group(1)
        area_query = geocode_area(area_name)
        if not area_query:
            return "Failed to geocode area."
        overpass_request = overpass_request.replace(match.group(0), area_query)
        
    url = "https://overpass-api.de/api/interpreter" 
    
    try:
        response = requests.post(url, data=overpass_request)
        response.raise_for_status() 

        return response.text 

    except requests.RequestException as e:
        return f"API request failed! Please correct the request and try again: {response.text}"

def get_best_nominatim(instr, filter_func):
    # Replace with actual Nominatim API request if needed
    url = f"https://nominatim.openstreetmap.org/search?X-Requested-With=overpass-turbo&format=json&q={instr}"
    headers = {
        "User-Agent": "MapLab.ai (service@maplab.ai)"  # Replace with your actual email or contact info
    }
    response = requests.get(url, headers=headers)
    if response.status_code != 200:
        return None
    results = response.json()
    for result in results:
        if filter_func(result):
            return result
    return None

def filter_nominatim_result(n):
    return "osm_type" in n and "osm_id" in n and n["osm_type"] != "node"

def geocode_area(instr):
    res = get_best_nominatim(instr, filter_nominatim_result)
    if not res:
        return None
    
    area_ref = int(res["osm_id"])
    
    if res["osm_type"] == "way":
        area_ref += 2400000000
    elif res["osm_type"] == "relation":
        area_ref += 3600000000
    
    if res["osm_type"] == "way":
        area_ref = f"{area_ref},{res['osm_id']}"
    
    return f"area(id:{area_ref})"

# Define a new graph

builder = StateGraph(State, input=InputState, config_schema=Configuration)

# Define the two nodes we will cycle between
builder.add_node(call_model)
builder.add_node(call_overpass)
builder.add_node("routing_tools", ToolNode(ROUTING_TOOLS))

# Set the entrypoint as `call_model`
# This means that this node is the first one called
builder.add_edge("__start__", "call_model")


def route_model_output(state: State) -> Literal["__end__", "routing_tools", "call_overpass"]:
    """Determine the next node based on the model's output.

    This function checks if the model's last message contains tool calls.

    Args:
        state (State): The current state of the conversation.

    Returns:
        str: The name of the next node to call ("__end__" or "tools" or "call_overpass").
    """
    last_message = state.messages[-1]
    if not isinstance(last_message, AIMessage):
        raise ValueError(
            f"Expected AIMessage in output edges, but got {type(last_message).__name__}"
        )
        
    if 'ROUTE_OVERPASS' in last_message.content:
        return "call_overpass"
    
    # If there is no tool call, then we finish
    if not last_message.tool_calls:
        return "__end__"
    
    # Otherwise we execute the requested actions
    return "routing_tools"

# Add a conditional edge to determine the next step after `call_model`
builder.add_conditional_edges(
    "call_model",
    # After call_model finishes running, the next node(s) are scheduled
    # based on the output from route_model_output
    route_model_output,
)

# Add a normal edge from `tools` to `call_model`
# This creates a cycle: after using tools, we always return to the model
builder.add_edge("routing_tools", "call_model")
builder.add_edge("call_overpass", "call_model")

# Compile the builder into an executable graph
# You can customize this by adding interrupt points for state updates
graph = builder.compile(
    interrupt_before=[],  # Add node names here to update state before they're called
    interrupt_after=[],  # Add node names here to update state after they're called
)
graph.name = "Maplab GIS ReAct Agent"  # This customizes the name in LangSmith

app = Flask(graph.name)
CORS(app)

@app.route('/geoassistant', methods=['POST']) 
async def invoke_assistant(): 
  
  userContent = request.json.get('user') 
  if not userContent: 
      return jsonify({"error": "Content is required"}), 400
  
  messages = [HumanMessage(content=userContent)]
  
  sysContent = request.json.get('system')
  if sysContent:
      messages.append(SystemMessage(content=sysContent))
  
  # resonse_messages = await graph.ainvoke({"messages": messages}, {"recursion_limit": 50})
  response_messages = await graph.ainvoke({"messages": messages}, {"recursion_limit": 50})
  
  result = []
  for m in response_messages['messages']:
      m.pretty_print()
      if (m.content != ""):
          result.append({
              "response": m.content
          })
  
  response = result[-1]['response']
  return response

if __name__ == '__main__': 
    app.run(debug=True)
