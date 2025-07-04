"""
LinkedIn Analytics Management
Handles organization page statistics and performance metrics
"""
from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta
from .base import LinkedInBaseClient

class LinkedInAnalytics(LinkedInBaseClient):
    """Handles LinkedIn organization analytics and statistics."""
    
    def __init__(self, access_token: Optional[str] = None, organization_id: str = "106542185"):
        super().__init__(access_token)
        self.organization_id = organization_id
        self.organization_urn = f"urn:li:organization:{organization_id}"
    
    def get_page_statistics(self, time_range: str = "30d") -> Dict[str, Any]:
        """
        Get organization page statistics.
        
        Args:
            time_range: Time range for statistics (7d, 30d, 90d)
            
        Returns:
            Dict with page statistics
        """
        # Calculate date range
        end_date = datetime.now()
        if time_range == "7d":
            start_date = end_date - timedelta(days=7)
        elif time_range == "30d":
            start_date = end_date - timedelta(days=30)
        elif time_range == "90d":
            start_date = end_date - timedelta(days=90)
        else:
            start_date = end_date - timedelta(days=30)
        
        params = {
            "q": "organization",
            "organization": self.organization_urn,
            "timeIntervals.timeGranularityType": "DAY",
            "timeIntervals.timeRange.start": int(start_date.timestamp() * 1000),
            "timeIntervals.timeRange.end": int(end_date.timestamp() * 1000)
        }
        
        result = self._make_request("GET", "/rest/organizationPageStatistics", params=params)
        
        if result["success"]:
            # Parse and structure the analytics data
            stats_data = result.get("data", {})
            result["analytics"] = self._parse_page_statistics(stats_data)
            
        return result
    
    def get_follower_statistics(self, time_range: str = "30d") -> Dict[str, Any]:
        """
        Get organization follower statistics.
        
        Args:
            time_range: Time range for statistics
            
        Returns:
            Dict with follower statistics
        """
        end_date = datetime.now()
        if time_range == "7d":
            start_date = end_date - timedelta(days=7)
        elif time_range == "30d":
            start_date = end_date - timedelta(days=30)
        elif time_range == "90d":
            start_date = end_date - timedelta(days=90)
        else:
            start_date = end_date - timedelta(days=30)
            
        params = {
            "q": "organizationalEntity",
            "organizationalEntity": self.organization_urn,
            "timeIntervals.timeGranularityType": "DAY",
            "timeIntervals.timeRange.start": int(start_date.timestamp() * 1000),
            "timeIntervals.timeRange.end": int(end_date.timestamp() * 1000)
        }
        
        return self._make_request("GET", "/rest/organizationalEntityFollowerStatistics", params=params)
    
    def get_share_statistics(self, time_range: str = "30d") -> Dict[str, Any]:
        """
        Get organization share/post statistics.
        
        Args:
            time_range: Time range for statistics
            
        Returns:
            Dict with share statistics
        """
        end_date = datetime.now()
        if time_range == "7d":
            start_date = end_date - timedelta(days=7)
        elif time_range == "30d":
            start_date = end_date - timedelta(days=30)
        elif time_range == "90d":
            start_date = end_date - timedelta(days=90)
        else:
            start_date = end_date - timedelta(days=30)
            
        params = {
            "q": "organizationalEntity",
            "organizationalEntity": self.organization_urn,
            "timeIntervals.timeGranularityType": "DAY",
            "timeIntervals.timeRange.start": int(start_date.timestamp() * 1000),
            "timeIntervals.timeRange.end": int(end_date.timestamp() * 1000)
        }
        
        return self._make_request("GET", "/rest/organizationalEntityShareStatistics", params=params)
    
    def get_video_analytics(self, post_urn: str) -> Dict[str, Any]:
        """
        Get analytics for a specific video post.
        
        Args:
            post_urn: URN of the video post
            
        Returns:
            Dict with video analytics
        """
        params = {
            "q": "entity",
            "entity": post_urn
        }
        
        return self._make_request("GET", "/rest/videoAnalytics", params=params)
    
    def get_comprehensive_analytics(self, time_range: str = "30d") -> Dict[str, Any]:
        """
        Get comprehensive analytics combining multiple metrics.
        
        Args:
            time_range: Time range for all statistics
            
        Returns:
            Dict with comprehensive analytics
        """
        analytics_report = {
            "time_range": time_range,
            "generated_at": datetime.now().isoformat(),
            "organization_id": self.organization_id
        }
        
        # Get page statistics
        page_stats = self.get_page_statistics(time_range)
        if page_stats["success"]:
            analytics_report["page_statistics"] = page_stats.get("analytics", {})
        else:
            analytics_report["page_statistics"] = {"error": page_stats.get("error")}
        
        # Get follower statistics  
        follower_stats = self.get_follower_statistics(time_range)
        if follower_stats["success"]:
            analytics_report["follower_statistics"] = follower_stats.get("data", {})
        else:
            analytics_report["follower_statistics"] = {"error": follower_stats.get("error")}
        
        # Get share statistics
        share_stats = self.get_share_statistics(time_range)
        if share_stats["success"]:
            analytics_report["share_statistics"] = share_stats.get("data", {})
        else:
            analytics_report["share_statistics"] = {"error": share_stats.get("error")}
        
        return {
            "success": True,
            "data": analytics_report
        }
    
    def _parse_page_statistics(self, stats_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Parse and structure page statistics data.
        
        Args:
            stats_data: Raw statistics data from API
            
        Returns:
            Structured analytics data
        """
        parsed = {
            "summary": {
                "total_page_views": 0,
                "unique_page_views": 0,
                "total_clicks": 0,
                "career_page_clicks": 0,
                "website_clicks": 0
            },
            "daily_breakdown": []
        }
        
        # Parse elements if they exist
        elements = stats_data.get("elements", [])
        
        for element in elements:
            total_page_views = element.get("totalPageStatistics", {})
            
            # Extract key metrics
            parsed["summary"]["total_page_views"] += total_page_views.get("views", {}).get("allPageViews", {}).get("pageViews", 0)
            parsed["summary"]["unique_page_views"] += total_page_views.get("views", {}).get("allPageViews", {}).get("uniquePageViews", 0)
            parsed["summary"]["total_clicks"] += total_page_views.get("clicks", {}).get("allClicks", {}).get("clicks", 0)
            parsed["summary"]["career_page_clicks"] += total_page_views.get("clicks", {}).get("careerPageClicks", {}).get("careerPageBannerClicks", 0)
            parsed["summary"]["website_clicks"] += total_page_views.get("clicks", {}).get("websiteClicks", {}).get("mobileBannerClicks", 0)
            
            # Add daily breakdown
            time_bound = element.get("timeRange", {})
            daily_data = {
                "date": datetime.fromtimestamp(time_bound.get("start", 0) / 1000).isoformat() if time_bound.get("start") else None,
                "page_views": total_page_views.get("views", {}).get("allPageViews", {}).get("pageViews", 0),
                "unique_views": total_page_views.get("views", {}).get("allPageViews", {}).get("uniquePageViews", 0),
                "clicks": total_page_views.get("clicks", {}).get("allClicks", {}).get("clicks", 0)
            }
            parsed["daily_breakdown"].append(daily_data)
        
        return parsed
    
    def export_analytics_csv(self, time_range: str = "30d", output_path: str = "linkedin_analytics.csv") -> Dict[str, Any]:
        """
        Export analytics data to CSV file.
        
        Args:
            time_range: Time range for analytics
            output_path: Path to save CSV file
            
        Returns:
            Dict with export status
        """
        import csv
        
        analytics = self.get_comprehensive_analytics(time_range)
        
        if not analytics["success"]:
            return analytics
            
        try:
            with open(output_path, 'w', newline='') as csvfile:
                writer = csv.writer(csvfile)
                
                # Write headers
                writer.writerow([
                    "Date", "Page Views", "Unique Views", "Clicks", 
                    "Engagement Rate", "Report Generated"
                ])
                
                # Write daily data
                daily_data = analytics["data"]["page_statistics"].get("daily_breakdown", [])
                for day in daily_data:
                    engagement_rate = (day["clicks"] / day["page_views"] * 100) if day["page_views"] > 0 else 0
                    writer.writerow([
                        day["date"],
                        day["page_views"], 
                        day["unique_views"],
                        day["clicks"],
                        f"{engagement_rate:.2f}%",
                        analytics["data"]["generated_at"]
                    ])
            
            return {
                "success": True,
                "output_file": output_path,
                "records_exported": len(daily_data)
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": f"Failed to export CSV: {str(e)}"
            }