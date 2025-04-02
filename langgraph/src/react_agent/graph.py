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
  
  # return {
  # "data": {
  #   "droppedOrders": [],
  #   "objective": 6114252,
  #   "totalDistance": 388540,
  #   "totalLoads": [
  #     {
  #       "productId": 1,
  #       "quantity": -76004
  #     },
  #     {
  #       "productId": 2,
  #       "quantity": -50954
  #     },
  #     {
  #       "productId": 3,
  #       "quantity": -25530
  #     }
  #   ],
  #   "vehicleRoutes": [
  #     {
  #       "totalRouteDistance": 56275,
  #       "totalRouteLoads": [
  #         {
  #           "productId": 1,
  #           "quantity": -6810
  #         },
  #         {
  #           "productId": 2,
  #           "quantity": -17128
  #         },
  #         {
  #           "productId": 3,
  #           "quantity": -15817
  #         }
  #       ],
  #       "vehicleId": 1000,
  #       "visits": [
  #         {
  #           "distanceFromLastNode": 9339,
  #           "loadsOnVisit": [
  #             {
  #               "productId": 1,
  #               "quantity": -8462
  #             },
  #             {
  #               "productId": 2,
  #               "quantity": -17128
  #             },
  #             {
  #               "productId": 3,
  #               "quantity": -15817
  #             }
  #           ],
  #           "nodeId": 88855,
  #           "nodeIndex": 25,
  #           "nodeLocation": {
  #             "latitude": 45.5025934,
  #             "longitude": -73.66434770000001
  #           },
  #           "order": 0
  #         },
  #         {
  #           "distanceFromLastNode": 34622,
  #           "loadsOnVisit": [
  #             {
  #               "productId": 1,
  #               "quantity": 523
  #             },
  #             {
  #               "productId": 2,
  #               "quantity": 0
  #             },
  #             {
  #               "productId": 3,
  #               "quantity": 0
  #             }
  #           ],
  #           "nodeId": 82403,
  #           "nodeIndex": 24,
  #           "nodeLocation": {
  #             "latitude": 45.509838,
  #             "longitude": -73.82255400000001
  #           },
  #           "order": 1,
  #         },
  #         {
  #           "distanceFromLastNode": 44380,
  #           "loadsOnVisit": [
  #             {
  #               "productId": 1,
  #               "quantity": 556
  #             },
  #             {
  #               "productId": 2,
  #               "quantity": 0
  #             },
  #             {
  #               "productId": 3,
  #               "quantity": 0
  #             }
  #           ],
  #           "nodeId": 14713,
  #           "nodeIndex": 19,
  #           "nodeLocation": {
  #             "latitude": 45.5108752,
  #             "longitude": -73.6792856
  #           },
  #           "order": 2,
  #         },
  #         {
  #           "distanceFromLastNode": 56275,
  #           "loadsOnVisit": [
  #             {
  #               "productId": 1,
  #               "quantity": 573
  #             },
  #             {
  #               "productId": 2,
  #               "quantity": 0
  #             },
  #             {
  #               "productId": 3,
  #               "quantity": 0
  #             }
  #           ],
  #           "nodeId": 13964,
  #           "nodeIndex": 23,
  #           "nodeLocation": {
  #             "latitude": 45.5319385,
  #             "longitude": -73.6694621
  #           },
  #           "order": 3,
  #         }
  #       ]
  #     },
  #     {
  #       "totalRouteDistance": 44170,
  #       "totalRouteLoads": [
  #         {
  #           "productId": 1,
  #           "quantity": -11296
  #         }
  #       ],
  #       "vehicleId": 1001,
  #       "visits": [
  #         {
  #           "distanceFromLastNode": 21661,
  #           "loadsOnVisit": [
  #             {
  #               "productId": 1,
  #               "quantity": -11710
  #             }
  #           ],
  #           "nodeId": 87583,
  #           "nodeIndex": 27,
  #           "nodeLocation": {
  #             "latitude": 45.5608215,
  #             "longitude": -73.73530070000001
  #           },
  #           "order": 0,
  #         },
  #         {
  #           "distanceFromLastNode": 44170,
  #           "loadsOnVisit": [
  #             {
  #               "productId": 1,
  #               "quantity": 414
  #             }
  #           ],
  #           "nodeId": 45017,
  #           "nodeIndex": 14,
  #           "nodeLocation": {
  #             "latitude": 45.607160400000005,
  #             "longitude": -73.6925906
  #           },
  #           "order": 1,
  #         }
  #       ]
  #     },
  #     {
  #       "totalRouteDistance": 29826,
  #       "totalRouteLoads": [
  #         {
  #           "productId": 1,
  #           "quantity": -14050
  #         },
  #         {
  #           "productId": 2,
  #           "quantity": -18107
  #         }
  #       ],
  #       "vehicleId": 1002,
  #       "visits": [
  #         {
  #           "distanceFromLastNode": 8207,
  #           "loadsOnVisit": [
  #             {
  #               "productId": 1,
  #               "quantity": -14450
  #             },
  #             {
  #               "productId": 2,
  #               "quantity": -18107
  #             }
  #           ],
  #           "nodeId": 67269,
  #           "nodeIndex": 8,
  #           "nodeLocation": {
  #             "latitude": 45.657362500000005,
  #             "longitude": -73.8847861
  #           },
  #           "order": 0,
             
  #         },
  #         {
  #           "distanceFromLastNode": 29826,
  #           "loadsOnVisit": [
  #             {
  #               "productId": 1,
  #               "quantity": 400
  #             },
  #             {
  #               "productId": 2,
  #               "quantity": 0
  #             }
  #           ],
  #           "nodeId": 38821,
  #           "nodeIndex": 12,
  #           "nodeLocation": {
  #             "latitude": 45.6363927,
  #             "longitude": -73.72322150000001
  #           },
  #           "order": 1,
             
  #         }
  #       ]
  #     },
  #     {
  #       "totalRouteDistance": 64388,
  #       "totalRouteLoads": [
  #         {
  #           "productId": 1,
  #           "quantity": -6968
  #         }
  #       ],
  #       "vehicleId": 1003,
  #       "visits": [
  #         {
  #           "distanceFromLastNode": 0,
  #           "loadsOnVisit": [
  #             {
  #               "productId": 1,
  #               "quantity": -9072
  #             }
  #           ],
  #           "nodeId": 97610,
  #           "nodeIndex": 22,
  #           "nodeLocation": {
  #             "latitude": 45.463526800000004,
  #             "longitude": -73.4664637
  #           },
  #           "order": 0,
             
  #         },
  #         {
  #           "distanceFromLastNode": 3721,
  #           "loadsOnVisit": [
  #             {
  #               "productId": 1,
  #               "quantity": 512
  #             }
  #           ],
  #           "nodeId": 13459,
  #           "nodeIndex": 10,
  #           "nodeLocation": {
  #             "latitude": 45.474848200000004,
  #             "longitude": -73.49883460000001
  #           },
  #           "order": 1,
             
  #         },
  #         {
  #           "distanceFromLastNode": 18741,
  #           "loadsOnVisit": [
  #             {
  #               "productId": 1,
  #               "quantity": 521
  #             }
  #           ],
  #           "nodeId": 70857,
  #           "nodeIndex": 30,
  #           "nodeLocation": {
  #             "latitude": 45.517691600000006,
  #             "longitude": -73.5499959
  #           },
  #           "order": 2,
             
  #         },
  #         {
  #           "distanceFromLastNode": 32653,
  #           "loadsOnVisit": [
  #             {
  #               "productId": 1,
  #               "quantity": 398
  #             }
  #           ],
  #           "nodeId": 15209,
  #           "nodeIndex": 18,
  #           "nodeLocation": {
  #             "latitude": 45.5146439,
  #             "longitude": -73.5848332
  #           },
  #           "order": 3,
             
  #         },
  #         {
  #           "distanceFromLastNode": 44292,
  #           "loadsOnVisit": [
  #             {
  #               "productId": 1,
  #               "quantity": 303
  #             }
  #           ],
  #           "nodeId": 67966,
  #           "nodeIndex": 11,
  #           "nodeLocation": {
  #             "latitude": 45.491321000000006,
  #             "longitude": -73.5805512
  #           },
  #           "order": 4,
             
  #         },
  #         {
  #           "distanceFromLastNode": 64388,
  #           "loadsOnVisit": [
  #             {
  #               "productId": 1,
  #               "quantity": 370
  #             }
  #           ],
  #           "nodeId": 11267,
  #           "nodeIndex": 28,
  #           "nodeLocation": {
  #             "latitude": 45.4195797,
  #             "longitude": -73.64422760000001
  #           },
  #           "order": 5,
             
  #         }
  #       ]
  #     },
  #     {
  #       "totalRouteDistance": 47496,
  #       "totalRouteLoads": [
  #         {
  #           "productId": 1,
  #           "quantity": -14499
  #         }
  #       ],
  #       "vehicleId": 1004,
  #       "visits": [
  #         {
  #           "distanceFromLastNode": 15680,
  #           "loadsOnVisit": [
  #             {
  #               "productId": 1,
  #               "quantity": -14934
  #             }
  #           ],
  #           "nodeId": 74752,
  #           "nodeIndex": 20,
  #           "nodeLocation": {
  #             "latitude": 45.447383800000004,
  #             "longitude": -73.7441247
  #           },
  #           "order": 0,
             
  #         },
  #         {
  #           "distanceFromLastNode": 47496,
  #           "loadsOnVisit": [
  #             {
  #               "productId": 1,
  #               "quantity": 435
  #             }
  #           ],
  #           "nodeId": 80805,
  #           "nodeIndex": 15,
  #           "nodeLocation": {
  #             "latitude": 45.448995800000006,
  #             "longitude": -73.8658298
  #           },
  #           "order": 1,
             
  #         }
  #       ]
  #     },
  #     {
  #       "totalRouteDistance": 77087,
  #       "totalRouteLoads": [
  #         {
  #           "productId": 1,
  #           "quantity": -9157
  #         },
  #         {
  #           "productId": 2,
  #           "quantity": -15719
  #         },
  #         {
  #           "productId": 3,
  #           "quantity": -9713
  #         }
  #       ],
  #       "vehicleId": 1005,
  #       "visits": [
  #         {
  #           "distanceFromLastNode": 21925,
  #           "loadsOnVisit": [
  #             {
  #               "productId": 1,
  #               "quantity": -10581
  #             },
  #             {
  #               "productId": 2,
  #               "quantity": -15719
  #             },
  #             {
  #               "productId": 3,
  #               "quantity": -9713
  #             }
  #           ],
  #           "nodeId": 14046,
  #           "nodeIndex": 13,
  #           "nodeLocation": {
  #             "latitude": 45.5694151,
  #             "longitude": -73.48611720000001
  #           },
  #           "order": 0,
             
  #         },
  #         {
  #           "distanceFromLastNode": 45425,
  #           "loadsOnVisit": [
  #             {
  #               "productId": 1,
  #               "quantity": 412
  #             },
  #             {
  #               "productId": 2,
  #               "quantity": 0
  #             },
  #             {
  #               "productId": 3,
  #               "quantity": 0
  #             }
  #           ],
  #           "nodeId": 21990,
  #           "nodeIndex": 17,
  #           "nodeLocation": {
  #             "latitude": 45.549410900000005,
  #             "longitude": -73.4968793
  #           },
  #           "order": 1,
             
  #         },
  #         {
  #           "distanceFromLastNode": 62587,
  #           "loadsOnVisit": [
  #             {
  #               "productId": 1,
  #               "quantity": 420
  #             },
  #             {
  #               "productId": 2,
  #               "quantity": 0
  #             },
  #             {
  #               "productId": 3,
  #               "quantity": 0
  #             }
  #           ],
  #           "nodeId": 34354,
  #           "nodeIndex": 16,
  #           "nodeLocation": {
  #             "latitude": 45.5535993,
  #             "longitude": -73.5544653
  #           },
  #           "order": 2,
             
  #         },
  #         {
  #           "distanceFromLastNode": 77087,
  #           "loadsOnVisit": [
  #             {
  #               "productId": 1,
  #               "quantity": 592
  #             },
  #             {
  #               "productId": 2,
  #               "quantity": 0
  #             },
  #             {
  #               "productId": 3,
  #               "quantity": 0
  #             }
  #           ],
  #           "nodeId": 94803,
  #           "nodeIndex": 29,
  #           "nodeLocation": {
  #             "latitude": 45.5750156,
  #             "longitude": -73.5896634
  #           },
  #           "order": 3,
             
  #         }
  #       ]
  #     },
  #     {
  #       "totalRouteDistance": 69298,
  #       "totalRouteLoads": [
  #         {
  #           "productId": 1,
  #           "quantity": -13224
  #         }
  #       ],
  #       "vehicleId": 1006,
  #       "visits": [
  #         {
  #           "distanceFromLastNode": 4080,
  #           "loadsOnVisit": [
  #             {
  #               "productId": 1,
  #               "quantity": -15032
  #             }
  #           ],
  #           "nodeId": 62678,
  #           "nodeIndex": 31,
  #           "nodeLocation": {
  #             "latitude": 45.6663482,
  #             "longitude": -73.4943957
  #           },
  #           "order": 0,
             
  #         },
  #         {
  #           "distanceFromLastNode": 14258,
  #           "loadsOnVisit": [
  #             {
  #               "productId": 1,
  #               "quantity": 506
  #             }
  #           ],
  #           "nodeId": 18848,
  #           "nodeIndex": 9,
  #           "nodeLocation": {
  #             "latitude": 45.666039000000005,
  #             "longitude": -73.5468398
  #           },
  #           "order": 1,
             
  #         },
  #         {
  #           "distanceFromLastNode": 38675,
  #           "loadsOnVisit": [
  #             {
  #               "productId": 1,
  #               "quantity": 435
  #             }
  #           ],
  #           "nodeId": 66655,
  #           "nodeIndex": 21,
  #           "nodeLocation": {
  #             "latitude": 45.707116000000006,
  #             "longitude": -73.64963230000001
  #           },
  #           "order": 2,
             
  #         },
  #         {
  #           "distanceFromLastNode": 55241,
  #           "loadsOnVisit": [
  #             {
  #               "productId": 1,
  #               "quantity": 468
  #             }
  #           ],
  #           "nodeId": 56925,
  #           "nodeIndex": 7,
  #           "nodeLocation": {
  #             "latitude": 45.696088800000005,
  #             "longitude": -73.6134463
  #           },
  #           "order": 3,
  #         },
  #         {
  #           "distanceFromLastNode": 69298,
  #           "loadsOnVisit": [
  #             {
  #               "productId": 1,
  #               "quantity": 399
  #             }
  #           ],
  #           "nodeId": 29914,
  #           "nodeIndex": 26,
  #           "nodeLocation": {
  #             "latitude": 45.7149968,
  #             "longitude": -73.57716950000001
  #           },
  #           "order": 4,
  #         }
  #       ]
  #     }
  #   ]
  # },
  # "message": "The delivery routes for your fleet have been optimized to minimize the traveled distance while considering time windows and truck capacity. Here is a summary of the optimized routes for each vehicle:\n\n1. **Vehicle 1000**:\n   - Total Route Distance: 56,275 meters\n   - Total Load: Product 1: -6,810, Product 2: -17,128, Product 3: -15,817\n   - Route:\n     - Start: Node 88855\n     - Visit Nodes: 82403, 14713, 13964\n\n2. **Vehicle 1001**:\n   - Total Route Distance: 44,170 meters\n   - Total Load: Product 1: -11,296\n   - Route:\n     - Start: Node 87583\n     - Visit Nodes: 45017\n\n3. **Vehicle 1002**:\n   - Total Route Distance: 29,826 meters\n   - Total Load: Product 1: -14,050, Product 2: -18,107\n   - Route:\n     - Start: Node 67269\n     - Visit Nodes: 38821\n\n4. **Vehicle 1003**:\n   - Total Route Distance: 64,388 meters\n   - Total Load: Product 1: -6,968\n   - Route:\n     - Start: Node 97610\n     - Visit Nodes: 13459, 70857, 15209, 67966, 11267\n\n5. **Vehicle 1004**:\n   - Total Route Distance: 47,496 meters\n   - Total Load: Product 1: -14,499\n   - Route:\n     - Start: Node 74752\n     - Visit Nodes: 80805\n\n6. **Vehicle 1005**:\n   - Total Route Distance: 77,087 meters\n   - Total Load: Product 1: -9,157, Product 2: -15,719, Product 3: -9,713\n   - Route:\n     - Start: Node 14046\n     - Visit Nodes: 21990, 34354, 94803\n\n7. **Vehicle 1006**:\n   - Total Route Distance: 69,298 meters\n   - Total Load: Product 1: -13,224\n   - Route:\n     - Start: Node 62678\n     - Visit Nodes: 18848, 66655, 56925, 29914\n\nNo orders were dropped during the optimization process. The total distance for all routes is 388,540 meters.",
  # "type": "route_optimization"
  # }
  
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
