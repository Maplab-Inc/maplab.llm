import os
from typing import Optional
from helpers.openapi_schema_helper import get_local_endpoint_schema
from langchain_core.tools import tool
import requests
from typing import Optional

@tool
def overpass(overpass_request: str) -> str:
    """
Overpass Tool for querying and visualizing OpenStreetMap data. It helps extract specific information from the vast OSM database by writing queries in the Overpass QL query language. 
Get Polygons Covering Areas: Fetching the boundary polygon for the city of Montreal.
Find Amenities: Finding all gas stations in Laval.
Custom Filters: finding all Italian restaurants in downtown Montreal with wheelchair access.
Analyzing Infrastructure: Retrieving all the bridges in a certain area.
    
    Args:
        overpass_request: A text string that contains the Overpass QL query. 
        example: // This query fetches all parks in Montreal [out:json][timeout:25]; // fetch area “Montreal” to search in {{geocodeArea:Montreal}}->.searchArea; // gather results ( node["leisure"="park"](area.searchArea); way["leisure"="park"](area.searchArea); relation["leisure"="park"](area.searchArea); ); // print results out body; >; out skel qt;
    """
    url = "https://overpass-api.de/api/interpreter" 
    
    try:
        response = requests.post(url, data=overpass_request)
        response.raise_for_status() 

        return response.text 

    except requests.RequestException as e:
        return f"API request failed! Please correct the request and try again: {response.text}"