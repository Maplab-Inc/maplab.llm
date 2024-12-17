import json
from typing import Optional

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