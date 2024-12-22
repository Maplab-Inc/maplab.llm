import requests
from typing import Optional
from helpers.openapi_schema_helper import get_local_endpoint_schema
from langchain_core.tools import tool
import requests
from typing import Optional

@tool
def optimize_routes(route_optimization_request: str) -> str:
    """
    Route optimization for a given list of vehicles and jobs.
    
    Args:
        route_optimization_request: A JSON string containing all necessary data. 
        To get the JSON schema structure that should be followed use the get_route_data_schema with "/api/v1/router/route-optimization" argument.} 
    """
    url = "https://api.maplab.ai/v1/optimization/resolve" 

    try:
        response = requests.post(url, data=route_optimization_request, headers={'Content-Type': 'application/json'})
        response.raise_for_status() 

        return response.text 

    except requests.RequestException as e:
        return f"API request failed! Please correct the request and try again: {response.text}"