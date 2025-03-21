"""This module provides example tools for web scraping and search functionality.

It includes a basic Tavily search function (as an example)

These tools are intended as free examples to get started. For production use,
consider implementing more robust and specialized tools tailored to your needs.
"""

from typing import Any, Callable, List, Optional, cast

from langchain_community.tools.tavily_search import TavilySearchResults
from langchain_core.runnables import RunnableConfig
from langchain_core.tools import InjectedToolArg
from typing_extensions import Annotated


from react_agent.configuration import Configuration

import os
import requests
import json

async def search(
    query: str, *, config: Annotated[RunnableConfig, InjectedToolArg]
) -> Optional[list[dict[str, Any]]]:
    """Search for general web results.

    This function performs a search using the Tavily search engine, which is designed
    to provide comprehensive, accurate, and trusted results. It's particularly useful
    for answering questions about current events.
    """
    configuration = Configuration.from_runnable_config(config)
    wrapped = TavilySearchResults(max_results=configuration.max_search_results)
    result = await wrapped.ainvoke({"query": query})
    return cast(list[dict[str, Any]], result)

async def direction(direction_request: str, *, config: Annotated[RunnableConfig, InjectedToolArg]) -> str:
    """
    Get direction from point A to point B.
    
    Args:
        direction_request: A JSON string containing all necessary data. 
        To get the JSON schema structure that should be followed use the get_route_data_schema and use the "/api/v1/router/directions" endpoint the "post" method.} 
    """
    configuration = Configuration.from_runnable_config(config)
    
    url = f"{configuration.maplab_base_url}router/directions" 
    api_key = os.environ.get("MAPLAB_API_KEY")
    
    headers = { 'Content-Type': 'application/json', 'X-API-KEY': api_key }

    try:
        response = requests.post(url, data=direction_request, headers=headers)
        response.raise_for_status() 

        return response.text 

    except requests.RequestException as e:
        return f"API request failed! Please correct the request and try again: {response.text}"
    
async def isochrone(isocrhone_request: str, *, config: Annotated[RunnableConfig, InjectedToolArg]) -> str:
    """
    Get isochrone (reachable area) from a point.
    
    Args:
        isocrhone_request: A JSON string containing all necessary data. 
        To get the JSON schema structure that should be followed use the get_route_data_schema and use the "/api/v1/router/isochrone" endpoint the "post" method.} 
    """
    configuration = Configuration.from_runnable_config(config)
    
    url = f"{configuration.maplab_base_url}router/isochrones" 
    api_key = os.environ.get("MAPLAB_API_KEY")
    
    headers = { 'Content-Type': 'application/json', 'X-API-KEY': api_key }

    try:
        response = requests.post(url, data=isocrhone_request, headers=headers)
        response.raise_for_status() 

        return response.text 

    except requests.RequestException as e:
        return f"API request failed! Please correct the request and try again: {response.text}"
    
async def matrix(matrix_request: str, *, config: Annotated[RunnableConfig, InjectedToolArg]) -> str:
    """
    Get travel distance/duration matrix between multiple points.
    
    Args:
        matrix_request: A JSON string containing all necessary data. 
        To get the JSON schema structure that should be followed use the get_route_data_schema and use the "/api/v1/router/matrix" endpoint the "post" method.} 
    """
    configuration = Configuration.from_runnable_config(config)
    
    url = f"{configuration.maplab_base_url}router/matrix" 
    api_key = os.environ.get("MAPLAB_API_KEY")
    
    headers = { 'Content-Type': 'application/json', 'X-API-KEY': api_key }

    try:
        response = requests.post(url, data=matrix_request, headers=headers)
        response.raise_for_status() 

        return response.text 

    except requests.RequestException as e:
        return f"API request failed! Please correct the request and try again: {response.text}"
    
async def optimize_routes(route_optimization_request: str, *, config: Annotated[RunnableConfig, InjectedToolArg]) -> str:
    """
    Call this tool to for route optimization of a given list of vehicles and jobs.
    
    Args:
        route_optimization_request: A JSON string containing all necessary data. 
        To get the JSON schema structure that should be followed use the get_route_data_schema with "/api/v1/router/route-optimization" argument.} 
    """
    configuration = Configuration.from_runnable_config(config)
    
    url = f"{configuration.maplab_base_url}optimization/resolve" 

    try:
        response = requests.post(url, data=route_optimization_request, headers={'Content-Type': 'application/json'})
        response.raise_for_status() 

        return response.text 

    except requests.RequestException as e:
        return f"API request failed! Please correct the request and try again: {response.text}"
    
import requests
import re

async def overpass(overpass_request: str) -> str:
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
    url = f"https://nominatim.openstreetmap.org/search?q={instr}&format=json&polygon_geojson=1&addressdetails=1"
    response = requests.get(url)
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

def get_local_endpoint_schema(endpoint: str) -> Optional[str]:
    """
    Loads the local OpenAPI JSON file and extracts the schema for a specific endpoint.

    Args:
        endpoint: The specific endpoint to extract (e.g., "/api/v1/route-optimization").
    """
    endpoint_to_file_path = { 
     "/api/v1/router/route-optimization": "./openapi/route_optimization.json", 
     "/api/v1/router/directions": "./openapi/openapi_directions.json",
     "/api/v1/router/isochrone": "./openapi/openapi_isochrone.json",
     "/api/v1/router/matrix": "./openapi/openapi_matrix.json"
    }
    local_file_path = endpoint_to_file_path.get(endpoint, "./openapi/openapi.json")
    
    try:
        # Load the local OpenAPI JSON file
        with open(local_file_path, 'r', encoding='utf-8') as file:
            openapi_data = json.load(file)
        
        return openapi_data

    except (FileNotFoundError, json.JSONDecodeError) as e:
        print(f"Failed to load OpenAPI JSON or extract endpoint schema: {e}")
        return None

ROUTING_TOOLS: List[Callable[..., Any]] = [direction, isochrone, matrix, optimize_routes, get_local_endpoint_schema]
QUERY_TOOLS: List[Callable[..., Any]] = [overpass]
