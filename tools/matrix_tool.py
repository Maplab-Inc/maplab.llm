import os
from typing import Optional
from helpers.openapi_schema_helper import get_local_endpoint_schema
from langchain_core.tools import tool
import requests
from typing import Optional

@tool
def matrix(matrix_request: str) -> str:
    """
    Get travel distance/duration matrix between multiple points.
    
    Args:
        matrix_request: A JSON string containing all necessary data. 
        To get the JSON schema structure that should be followed use the get_route_data_schema and use the "/api/v1/router/matrix" endpoint the "post" method.} 
    """
    url = "https://api.maplab.ai/v1/router/matrix" 
    api_key = os.environ.get("MAPLAB_API_KEY")
    
    headers = { 'Content-Type': 'application/json', 'X-API-KEY': api_key }

    try:
        response = requests.post(url, data=matrix_request, headers=headers)
        response.raise_for_status() 

        return response.text 

    except requests.RequestException as e:
        return f"API request failed! Please correct the request and try again: {response.text}"