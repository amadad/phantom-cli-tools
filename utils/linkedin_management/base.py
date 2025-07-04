"""
Base LinkedIn API client for all management modules
"""
import os
import requests
import json
from typing import Dict, Any, Optional
from datetime import datetime

class LinkedInBaseClient:
    """Base client for LinkedIn API interactions."""
    
    def __init__(self, access_token: Optional[str] = None):
        self.access_token = access_token or os.getenv('LINKEDIN_ACCESS_TOKEN')
        self.base_url = "https://api.linkedin.com"
        self.api_version = "202505"
        
        if not self.access_token:
            raise ValueError("LinkedIn access token required. Set LINKEDIN_ACCESS_TOKEN environment variable.")
    
    def _get_headers(self, additional_headers: Optional[Dict[str, str]] = None) -> Dict[str, str]:
        """Get standard headers for LinkedIn API requests."""
        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json",
            "LinkedIn-Version": self.api_version
        }
        
        if additional_headers:
            headers.update(additional_headers)
            
        return headers
    
    def _make_request(self, method: str, endpoint: str, data: Optional[Dict] = None, 
                     params: Optional[Dict] = None, additional_headers: Optional[Dict] = None) -> Dict[str, Any]:
        """Make a request to LinkedIn API with error handling."""
        url = f"{self.base_url}{endpoint}"
        headers = self._get_headers(additional_headers)
        
        try:
            if method.upper() == "GET":
                response = requests.get(url, headers=headers, params=params)
            elif method.upper() == "POST":
                response = requests.post(url, headers=headers, json=data, params=params)
            elif method.upper() == "PUT":
                response = requests.put(url, headers=headers, json=data, params=params)
            elif method.upper() == "DELETE":
                response = requests.delete(url, headers=headers, params=params)
            elif method.upper() == "PATCH":
                response = requests.patch(url, headers=headers, json=data, params=params)
            else:
                raise ValueError(f"Unsupported HTTP method: {method}")
            
            # Parse response
            result = {
                "success": response.status_code in [200, 201, 202, 204],
                "status_code": response.status_code,
                "timestamp": datetime.now().isoformat()
            }
            
            if response.content:
                try:
                    result["data"] = response.json()
                except json.JSONDecodeError:
                    result["data"] = response.text
            
            if not result["success"]:
                result["error"] = response.text
                
            return result
            
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            }
    
    def get_organization_info(self, organization_id: str) -> Dict[str, Any]:
        """Get organization information."""
        return self._make_request("GET", f"/rest/organizations/{organization_id}")
    
    def health_check(self) -> Dict[str, Any]:
        """Simple health check for the LinkedIn API connection."""
        return self._make_request("GET", "/rest/me")