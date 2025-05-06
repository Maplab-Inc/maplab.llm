from typing import Dict, List, Literal, cast

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, ToolMessage
from langchain_core.runnables import RunnableConfig
from langgraph.graph import StateGraph
from langgraph.prebuilt import ToolNode

from react_agent.configuration import Configuration
from react_agent.state import InputState, State
from react_agent.tools import GEOMETRY_TOOLS, ROUTE_OPTIMIZATION_TOOLS, ROUTING_TOOLS, QUERY_TOOLS
from react_agent.utils import load_chat_model

from flask import Flask, jsonify, request
from flask_cors import CORS
import requests
import copy
import json
import re

# Define the function that calls the model

async def orchestrator(
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
    model = load_chat_model(configuration.model)

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
    is_geometry_response = (
        isinstance(last_message, AIMessage) and 
        last_message.additional_kwargs.get("origin") == "geometry"
    )
    is_route_optimization_response = (
        isinstance(last_message, AIMessage) and 
        last_message.additional_kwargs.get("origin") == "route_optimization"
    )
    
    content_type = ''

    if is_overpass_response:
        content_type = 'overpass'
    elif is_geometry_response:
        content_type = 'geometry'
    elif is_route_optimization_response:
        content_type = 'route_optimization'
        
    if content_type and len(last_message.content) > 2000:
        messages[-1].content = "The  response is too large to be included directly. It has been saved in memory. Please generate the final response as usual and the response data will be replaced dynamically."
        
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
        parsed_data = json.loads(last_message.content)
        response.content = {
            "message": response.content,
            "data": parsed_data,
            "type": content_type,
        }

    return {"messages": [response]}

async def query(
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
    
async def geometry(
    state: State, config: RunnableConfig
) -> Dict[str, List[AIMessage]]:
    """Call the Geometry LLM."""

    configuration = Configuration.from_runnable_config(config)

    model = load_chat_model(configuration.geometry_model).bind_tools(GEOMETRY_TOOLS)

    system_message = configuration.geometry_system_prompt
    
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
        
    response.additional_kwargs["origin"] = "geometry"
        
    return {"messages": [response]}

async def routing(
    state: State, config: RunnableConfig
) -> Dict[str, List[AIMessage]]:
    """Call the Routing LLM."""

    configuration = Configuration.from_runnable_config(config)

    model = load_chat_model(configuration.routing_model).bind_tools(ROUTING_TOOLS)

    system_message = configuration.routing_system_prompt
    
    last_message = state.messages[-1]
    
    if last_message.type == 'tool' and last_message.status == 'success':
        return {
            "messages": [
                AIMessage(
                    id=last_message.id,
                    content=last_message.content,
                    additional_kwargs={"origin": "routing"},
                )
            ]
        }

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
        
    return {"messages": [response]}

async def route_optimization(
    state: State, config: RunnableConfig
) -> Dict[str, List[AIMessage]]:
    """Call the Routing LLM."""

    configuration = Configuration.from_runnable_config(config)

    model = load_chat_model(configuration.route_optimization_model).bind_tools(ROUTE_OPTIMIZATION_TOOLS)

    system_message = configuration.route_optimization_system_prompt
    
    last_message = state.messages[-1]
    
    # if last_message.type == 'tool' and last_message.name == 'optimize_routes' and last_message.status == 'success':
    #     return {
    #         "messages": [
    #             AIMessage(
    #                 id=last_message.id,
    #                 content=last_message.content,
    #                 additional_kwargs={"origin": "route_optimization"},
    #             )
    #         ]
    #     }

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
        
    response.additional_kwargs["origin"] = "route_optimization"
        
    return {"messages": [response]}

def orchestrator_conditional_edges(state: State) -> Literal["__end__", "query", "geometry", "routing", "route_optimization"]:
    """Determine the next node based on the model's output.

    This function checks if the model's last message contains tool calls.

    Args:
        state (State): The current state of the conversation.

    Returns:
        str: The name of the next node to call ("__end__", "query", "geometry", "routing").
    """
    last_message = state.messages[-1]
    if not isinstance(last_message, AIMessage):
        raise ValueError(
            f"Expected AIMessage in output edges, but got {type(last_message).__name__}"
        )
        
    if 'ROUTE_OVERPASS' in last_message.content:
        return "query"
    
    if 'ROUTE_GEOMETRY' in last_message.content:
        return "geometry"
    
    if 'ROUTE_ROUTING' in last_message.content:
        return "routing"
    
    if 'ROUTE_OPTIMIZATION' in last_message.content:
        return "route_optimization"
    
    return "__end__"

def routing_conditional_edges(state: State) -> Literal["routing_tools", "orchestrator"]:
    """Determine the next node based on the model's output.

    This function checks if the model's last message contains tool calls.

    Args:
        state (State): The current state of the conversation.

    Returns:
        str: The name of the next node to call ("routing_tools", "orchestrator").
    """
    last_message = state.messages[-1]
    if not isinstance(last_message, AIMessage):
        raise ValueError(
            f"Expected AIMessage in output edges, but got {type(last_message).__name__}"
        )
        
    if not last_message.tool_calls:
        return "orchestrator"
    
    return "routing_tools"

def route_optimization_conditional_edges(state: State) -> Literal["route_optimization_tools", "orchestrator"]:
    """Determine the next node based on the model's output.

    This function checks if the model's last message contains tool calls.

    Args:
        state (State): The current state of the conversation.

    Returns:
        str: The name of the next node to call ("routing_tools", "orchestrator").
    """
    last_message = state.messages[-1]
    if not isinstance(last_message, AIMessage):
        raise ValueError(
            f"Expected AIMessage in output edges, but got {type(last_message).__name__}"
        )
        
    if not last_message.tool_calls:
        return "orchestrator"
    
    return "route_optimization_tools"

def geometry_conditional_edges(state: State) -> Literal["geometry_tools", "orchestrator"]:
    """Determine the next node based on the model's output.

    This function checks if the model's last message contains tool calls.

    Args:
        state (State): The current state of the conversation.

    Returns:
        str: The name of the next node to call ("geometry_tools", "orchestrator").
    """
    last_message = state.messages[-1]
    if not isinstance(last_message, AIMessage):
        raise ValueError(
            f"Expected AIMessage in output edges, but got {type(last_message).__name__}"
        )
        
    if not last_message.tool_calls:
        return "orchestrator"
    
    return "geometry_tools"

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

builder = StateGraph(State, input=InputState, config_schema=Configuration)

builder.add_node(orchestrator)
builder.add_node(query)
builder.add_node(geometry)
builder.add_node(route_optimization)
builder.add_node(routing)
builder.add_node("routing_tools", ToolNode(ROUTING_TOOLS))
builder.add_node("route_optimization_tools", ToolNode(ROUTE_OPTIMIZATION_TOOLS))
builder.add_node("geometry_tools", ToolNode(GEOMETRY_TOOLS))

# Set the entrypoint as `orchestrator`
# This means that this node is the first one called
builder.add_edge("__start__", "orchestrator")

# Add a conditional edge to determine the next step after `orchestrator`
builder.add_conditional_edges(
    "orchestrator",
    # After orchestrator finishes running, the next node(s) are scheduled
    # based on the output from route_model_output
    orchestrator_conditional_edges,
)

builder.add_conditional_edges(
    "routing",
    # After orchestrator finishes running, the next node(s) are scheduled
    # based on the output from route_model_output
    routing_conditional_edges,
)

builder.add_conditional_edges(
    "route_optimization",
    # After orchestrator finishes running, the next node(s) are scheduled
    # based on the output from route_model_output
    route_optimization_conditional_edges,
)

builder.add_conditional_edges(
    "geometry",
    # After orchestrator finishes running, the next node(s) are scheduled
    # based on the output from route_model_output
    geometry_conditional_edges,
)

# Add a normal edge from `tools` to `orchestrator`
# This creates a cycle: after using tools, we always return to the model
builder.add_edge("query", "orchestrator")
builder.add_edge("routing_tools", "routing")
builder.add_edge("route_optimization_tools", "route_optimization")
builder.add_edge("geometry_tools", "geometry")

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
      
  fileContent = request.json.get('file')
  if fileContent:
      messages.append(SystemMessage(content=fileContent))
  
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
