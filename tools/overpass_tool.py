import os
from typing import Optional
from helpers.openapi_schema_helper import get_local_endpoint_schema
from langchain_core.tools import tool
import requests
from typing import Optional
import urllib.parse

@tool
def overpass(overpass_request: str) -> str:
    """
    Overpass Tool for querying and visualizing OpenStreetMap data. It helps extract specific information from the vast OSM database by writing queries in the Overpass QL query language. 
    Args:
        overpass_request: A text string that contains the Overpass QL query. 
    """
    url = "https://overpass-api.de/api/interpreter" 
    
    try:
        # overpass_request = """[out:json][timeout:25];{{geocodeArea:Montreal}}->.searchArea;(way[boundary=administrative](area.searchArea);relation[boundary=administrative](area.searchArea););out body geom;"""
        overpass_request = """[out:json][timeout:25];area[name="Montreal"][admin_level=8];node["amenity"="fuel"](area);out;"""
        encoded_query = urllib.parse.quote(overpass_request, safe='')
        print(f"calling overpass with following query >>> {encoded_query}")
        response = requests.post(url, data=f"data={encoded_query}")
        print(f"got following overpass response status >>> {response.status_code}")
        print(f"got following overpass response content >>> {response.content}")
        response.raise_for_status() 

        return response.text 

    except requests.RequestException as e:
        return f"API request failed! Please correct the request and try again: {response.text}"