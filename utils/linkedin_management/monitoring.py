"""
LinkedIn Monitoring Management
Handles notifications, mentions, and content monitoring
"""
from typing import Dict, Any, Optional, List, Callable
from datetime import datetime, timedelta
import json
import time
from .base import LinkedInBaseClient

class LinkedInMonitoring(LinkedInBaseClient):
    """Handles LinkedIn monitoring and notification operations."""
    
    def __init__(self, access_token: Optional[str] = None, organization_id: str = "106542185"):
        super().__init__(access_token)
        self.organization_id = organization_id
        self.organization_urn = f"urn:li:organization:{organization_id}"
        self.monitoring_active = False
        self.notification_handlers = {}
    
    def get_organizational_notifications(self, time_range: str = "24h") -> Dict[str, Any]:
        """
        Get organizational notifications and mentions.
        
        Args:
            time_range: Time range for notifications (1h, 24h, 7d)
            
        Returns:
            Dict with notifications data
        """
        # Calculate time range
        end_time = datetime.now()
        if time_range == "1h":
            start_time = end_time - timedelta(hours=1)
        elif time_range == "24h":
            start_time = end_time - timedelta(hours=24)
        elif time_range == "7d":
            start_time = end_time - timedelta(days=7)
        else:
            start_time = end_time - timedelta(hours=24)
        
        params = {
            "q": "criteria",
            "criteria.organizationalEntity": self.organization_urn,
            "criteria.timeRange.start": int(start_time.timestamp() * 1000),
            "criteria.timeRange.end": int(end_time.timestamp() * 1000)
        }
        
        return self._make_request("GET", "/rest/organizationalEntityNotifications", params=params)
    
    def monitor_brand_mentions(self, keywords: List[str], check_interval: int = 300) -> Dict[str, Any]:
        """
        Monitor for brand mentions across LinkedIn.
        
        Args:
            keywords: List of keywords to monitor
            check_interval: Check interval in seconds
            
        Returns:
            Dict with monitoring status
        """
        monitoring_config = {
            "keywords": keywords,
            "check_interval": check_interval,
            "started_at": datetime.now().isoformat(),
            "organization_id": self.organization_id
        }
        
        # In a real implementation, this would start a background monitoring process
        # For now, we'll return the configuration
        return {
            "success": True,
            "data": monitoring_config,
            "message": "Brand mention monitoring configured. Use start_monitoring() to begin."
        }
    
    def start_monitoring(self, callback_function: Optional[Callable] = None) -> Dict[str, Any]:
        """
        Start the monitoring process.
        
        Args:
            callback_function: Function to call when new mentions are found
            
        Returns:
            Dict with monitoring status
        """
        if self.monitoring_active:
            return {
                "success": False,
                "error": "Monitoring is already active"
            }
        
        self.monitoring_active = True
        
        # In a real implementation, this would start a background thread/process
        monitoring_status = {
            "active": True,
            "started_at": datetime.now().isoformat(),
            "callback_registered": callback_function is not None
        }
        
        return {
            "success": True,
            "data": monitoring_status
        }
    
    def stop_monitoring(self) -> Dict[str, Any]:
        """
        Stop the monitoring process.
        
        Returns:
            Dict with stop status
        """
        self.monitoring_active = False
        
        return {
            "success": True,
            "message": "Monitoring stopped",
            "stopped_at": datetime.now().isoformat()
        }
    
    def check_new_comments(self, post_urns: List[str]) -> Dict[str, Any]:
        """
        Check for new comments on specified posts.
        
        Args:
            post_urns: List of post URNs to check
            
        Returns:
            Dict with new comments data
        """
        new_comments = {
            "posts_checked": len(post_urns),
            "total_new_comments": 0,
            "posts_with_new_comments": []
        }
        
        for post_urn in post_urns:
            comments_result = self._make_request("GET", f"/rest/socialActions/{post_urn}/comments", 
                                               params={"count": 10})
            
            if comments_result["success"]:
                comments = comments_result.get("data", {}).get("elements", [])
                
                # Filter for recent comments (last 24 hours)
                recent_comments = []
                cutoff_time = datetime.now() - timedelta(hours=24)
                
                for comment in comments:
                    created_time = comment.get("created", {}).get("time", 0)
                    if created_time and datetime.fromtimestamp(created_time / 1000) > cutoff_time:
                        recent_comments.append(comment)
                
                if recent_comments:
                    new_comments["posts_with_new_comments"].append({
                        "post_urn": post_urn,
                        "new_comments_count": len(recent_comments),
                        "comments": recent_comments
                    })
                    new_comments["total_new_comments"] += len(recent_comments)
        
        return {
            "success": True,
            "data": new_comments
        }
    
    def setup_auto_response(self, trigger_keywords: List[str], response_template: str, 
                           response_delay: int = 60) -> Dict[str, Any]:
        """
        Set up automatic responses to comments containing specific keywords.
        
        Args:
            trigger_keywords: Keywords that trigger auto-response
            response_template: Template for the response
            response_delay: Delay before responding (in seconds)
            
        Returns:
            Dict with auto-response configuration
        """
        auto_response_config = {
            "trigger_keywords": trigger_keywords,
            "response_template": response_template,
            "response_delay": response_delay,
            "enabled": True,
            "created_at": datetime.now().isoformat()
        }
        
        # Store in notification handlers
        handler_id = f"auto_response_{int(time.time())}"
        self.notification_handlers[handler_id] = auto_response_config
        
        return {
            "success": True,
            "handler_id": handler_id,
            "data": auto_response_config
        }
    
    def get_engagement_alerts(self, threshold_metrics: Dict[str, int]) -> Dict[str, Any]:
        """
        Check for posts that meet engagement alert thresholds.
        
        Args:
            threshold_metrics: Dict with metrics and their thresholds
                              e.g., {"likes": 100, "comments": 20, "shares": 10}
            
        Returns:
            Dict with posts meeting alert criteria
        """
        # Get recent organization posts
        posts_result = self._make_request("GET", "/rest/posts", 
                                        params={"author": self.organization_urn, "count": 20})
        
        if not posts_result["success"]:
            return posts_result
        
        posts = posts_result.get("data", {}).get("elements", [])
        alert_posts = []
        
        for post in posts:
            post_urn = post.get("id")
            
            # Get social metadata for the post
            metadata_result = self._make_request("GET", f"/rest/socialMetadata/{post_urn}")
            
            if metadata_result["success"]:
                metadata = metadata_result.get("data", {})
                
                # Check if post meets any threshold
                likes_count = metadata.get("totalSocialActivityCounts", {}).get("numLikes", 0)
                comments_count = metadata.get("totalSocialActivityCounts", {}).get("numComments", 0)
                shares_count = metadata.get("totalSocialActivityCounts", {}).get("numShares", 0)
                
                meets_threshold = False
                triggered_metrics = []
                
                if "likes" in threshold_metrics and likes_count >= threshold_metrics["likes"]:
                    meets_threshold = True
                    triggered_metrics.append(f"likes: {likes_count}")
                
                if "comments" in threshold_metrics and comments_count >= threshold_metrics["comments"]:
                    meets_threshold = True
                    triggered_metrics.append(f"comments: {comments_count}")
                
                if "shares" in threshold_metrics and shares_count >= threshold_metrics["shares"]:
                    meets_threshold = True
                    triggered_metrics.append(f"shares: {shares_count}")
                
                if meets_threshold:
                    alert_posts.append({
                        "post_urn": post_urn,
                        "post_content": post.get("commentary", "")[:100] + "...",
                        "triggered_metrics": triggered_metrics,
                        "engagement_data": {
                            "likes": likes_count,
                            "comments": comments_count,
                            "shares": shares_count
                        }
                    })
        
        return {
            "success": True,
            "data": {
                "alert_posts": alert_posts,
                "total_alerts": len(alert_posts),
                "threshold_metrics": threshold_metrics
            }
        }
    
    def export_monitoring_report(self, time_range: str = "7d", output_path: str = "monitoring_report.json") -> Dict[str, Any]:
        """
        Export a comprehensive monitoring report.
        
        Args:
            time_range: Time range for the report
            output_path: Path to save the report
            
        Returns:
            Dict with export status
        """
        report_data = {
            "report_generated": datetime.now().isoformat(),
            "time_range": time_range,
            "organization_id": self.organization_id
        }
        
        # Get notifications
        notifications = self.get_organizational_notifications(time_range)
        if notifications["success"]:
            report_data["notifications"] = notifications.get("data", {})
        
        # Get engagement alerts (example thresholds)
        alerts = self.get_engagement_alerts({"likes": 50, "comments": 10, "shares": 5})
        if alerts["success"]:
            report_data["engagement_alerts"] = alerts.get("data", {})
        
        # Add monitoring configuration
        report_data["monitoring_config"] = {
            "active": self.monitoring_active,
            "handlers": list(self.notification_handlers.keys())
        }
        
        try:
            with open(output_path, 'w') as f:
                json.dump(report_data, f, indent=2)
            
            return {
                "success": True,
                "output_file": output_path,
                "report_data": report_data
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": f"Failed to export report: {str(e)}"
            }
    
    def get_monitoring_dashboard(self) -> Dict[str, Any]:
        """
        Get a real-time monitoring dashboard overview.
        
        Returns:
            Dict with dashboard data
        """
        dashboard = {
            "status": {
                "monitoring_active": self.monitoring_active,
                "handlers_count": len(self.notification_handlers),
                "last_updated": datetime.now().isoformat()
            },
            "recent_activity": {},
            "alerts": {},
            "configuration": {
                "organization_id": self.organization_id,
                "handlers": list(self.notification_handlers.keys())
            }
        }
        
        # Get recent notifications (last hour)
        recent_notifications = self.get_organizational_notifications("1h")
        if recent_notifications["success"]:
            dashboard["recent_activity"] = recent_notifications.get("data", {})
        
        # Get current engagement alerts
        current_alerts = self.get_engagement_alerts({"likes": 25, "comments": 5})
        if current_alerts["success"]:
            dashboard["alerts"] = current_alerts.get("data", {})
        
        return {
            "success": True,
            "dashboard": dashboard
        }