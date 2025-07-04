"""
LinkedIn Engagement Management
Handles reactions, comments, and social interactions
"""
from typing import Dict, Any, Optional, List
from .base import LinkedInBaseClient

class LinkedInEngagement(LinkedInBaseClient):
    """Handles LinkedIn engagement operations like reactions and comments."""
    
    def __init__(self, access_token: Optional[str] = None, organization_id: str = "106542185"):
        super().__init__(access_token)
        self.organization_id = organization_id
        self.organization_urn = f"urn:li:organization:{organization_id}"
    
    def create_reaction(self, post_urn: str, reaction_type: str = "LIKE") -> Dict[str, Any]:
        """
        Create a reaction to a post.
        
        Args:
            post_urn: URN of the post to react to
            reaction_type: Type of reaction (LIKE, CELEBRATE, LOVE, INSIGHTFUL, CURIOUS)
            
        Returns:
            Dict with reaction status
        """
        reaction_data = {
            "actor": self.organization_urn,
            "object": post_urn,
            "reactionType": reaction_type.upper()
        }
        
        return self._make_request("POST", "/rest/reactions", data=reaction_data)
    
    def get_post_reactions(self, post_urn: str) -> Dict[str, Any]:
        """
        Get reactions for a specific post.
        
        Args:
            post_urn: URN of the post
            
        Returns:
            Dict with reactions data
        """
        params = {
            "q": "entity",
            "entity": post_urn
        }
        
        return self._make_request("GET", "/rest/reactions", params=params)
    
    def delete_reaction(self, reaction_id: str) -> Dict[str, Any]:
        """
        Delete a reaction.
        
        Args:
            reaction_id: ID of the reaction to delete
            
        Returns:
            Dict with deletion status
        """
        return self._make_request("DELETE", f"/rest/reactions/{reaction_id}")
    
    def create_comment(self, post_urn: str, comment_text: str, parent_comment_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Create a comment on a post.
        
        Args:
            post_urn: URN of the post to comment on
            comment_text: Text content of the comment
            parent_comment_id: ID of parent comment for replies
            
        Returns:
            Dict with comment creation status
        """
        comment_data = {
            "actor": self.organization_urn,
            "object": post_urn,
            "message": {
                "text": comment_text
            }
        }
        
        if parent_comment_id:
            comment_data["parentComment"] = parent_comment_id
        
        return self._make_request("POST", f"/rest/socialActions/{post_urn}/comments", data=comment_data)
    
    def get_post_comments(self, post_urn: str, count: int = 20) -> Dict[str, Any]:
        """
        Get comments for a specific post.
        
        Args:
            post_urn: URN of the post
            count: Number of comments to retrieve
            
        Returns:
            Dict with comments data
        """
        params = {
            "count": count
        }
        
        return self._make_request("GET", f"/rest/socialActions/{post_urn}/comments", params=params)
    
    def update_comment(self, post_urn: str, comment_id: str, updated_text: str) -> Dict[str, Any]:
        """
        Update an existing comment.
        
        Args:
            post_urn: URN of the post
            comment_id: ID of the comment to update
            updated_text: New text for the comment
            
        Returns:
            Dict with update status
        """
        update_data = {
            "message": {
                "text": updated_text
            }
        }
        
        return self._make_request("PATCH", f"/rest/socialActions/{post_urn}/comments/{comment_id}", data=update_data)
    
    def delete_comment(self, post_urn: str, comment_id: str) -> Dict[str, Any]:
        """
        Delete a comment.
        
        Args:
            post_urn: URN of the post
            comment_id: ID of the comment to delete
            
        Returns:
            Dict with deletion status
        """
        return self._make_request("DELETE", f"/rest/socialActions/{post_urn}/comments/{comment_id}")
    
    def get_post_likes(self, post_urn: str, count: int = 50) -> Dict[str, Any]:
        """
        Get likes for a specific post.
        
        Args:
            post_urn: URN of the post
            count: Number of likes to retrieve
            
        Returns:
            Dict with likes data
        """
        params = {
            "count": count
        }
        
        return self._make_request("GET", f"/rest/socialActions/{post_urn}/likes", params=params)
    
    def create_like(self, post_urn: str) -> Dict[str, Any]:
        """
        Like a post.
        
        Args:
            post_urn: URN of the post to like
            
        Returns:
            Dict with like status
        """
        like_data = {
            "actor": self.organization_urn
        }
        
        return self._make_request("POST", f"/rest/socialActions/{post_urn}/likes", data=like_data)
    
    def delete_like(self, post_urn: str, liker_urn: str) -> Dict[str, Any]:
        """
        Remove a like from a post.
        
        Args:
            post_urn: URN of the post
            liker_urn: URN of the entity that liked the post
            
        Returns:
            Dict with deletion status
        """
        return self._make_request("DELETE", f"/rest/socialActions/{post_urn}/likes/{liker_urn}")
    
    def get_social_metadata(self, entity_urn: str) -> Dict[str, Any]:
        """
        Get social metadata for an entity (post, comment, etc.).
        
        Args:
            entity_urn: URN of the entity
            
        Returns:
            Dict with social metadata
        """
        return self._make_request("GET", f"/rest/socialMetadata/{entity_urn}")
    
    def auto_engage_with_keywords(self, keywords: List[str], reaction_type: str = "LIKE", 
                                 max_posts: int = 10) -> Dict[str, Any]:
        """
        Automatically engage with posts containing specific keywords.
        
        Args:
            keywords: List of keywords to search for
            reaction_type: Type of reaction to use
            max_posts: Maximum number of posts to engage with
            
        Returns:
            Dict with engagement results
        """
        engagement_results = {
            "keywords_searched": keywords,
            "posts_engaged": 0,
            "successful_reactions": [],
            "failed_reactions": [],
            "max_posts": max_posts
        }
        
        # This would typically involve searching for posts first
        # For now, we'll return a placeholder structure
        # In a real implementation, you'd search for posts with keywords
        # and then engage with them
        
        return {
            "success": True,
            "data": engagement_results,
            "message": "Auto-engagement feature ready for implementation"
        }
    
    def bulk_comment_reply(self, post_urn: str, reply_template: str, 
                          target_keywords: Optional[List[str]] = None) -> Dict[str, Any]:
        """
        Reply to multiple comments on a post with a template.
        
        Args:
            post_urn: URN of the post
            reply_template: Template for replies (can include {name} placeholder)
            target_keywords: Only reply to comments containing these keywords
            
        Returns:
            Dict with bulk reply results
        """
        # Get existing comments
        comments_result = self.get_post_comments(post_urn, count=100)
        
        if not comments_result["success"]:
            return comments_result
        
        comments_data = comments_result.get("data", {}).get("elements", [])
        
        reply_results = {
            "total_comments": len(comments_data),
            "replies_sent": 0,
            "successful_replies": [],
            "failed_replies": []
        }
        
        for comment in comments_data:
            comment_text = comment.get("message", {}).get("text", "")
            comment_id = comment.get("id")
            commenter_name = comment.get("actor", {}).get("name", "there")
            
            # Check if comment contains target keywords (if specified)
            if target_keywords:
                if not any(keyword.lower() in comment_text.lower() for keyword in target_keywords):
                    continue
            
            # Format reply with commenter's name
            personalized_reply = reply_template.replace("{name}", commenter_name)
            
            # Create reply
            reply_result = self.create_comment(post_urn, personalized_reply, comment_id)
            
            if reply_result["success"]:
                reply_results["successful_replies"].append({
                    "comment_id": comment_id,
                    "reply": personalized_reply
                })
                reply_results["replies_sent"] += 1
            else:
                reply_results["failed_replies"].append({
                    "comment_id": comment_id,
                    "error": reply_result.get("error")
                })
        
        return {
            "success": True,
            "data": reply_results
        }