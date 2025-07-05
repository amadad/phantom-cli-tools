"""
X (Twitter) Complete Social Management
All X functionality in a single file with brand integration
"""

import os
import asyncio
import aiohttp
import json
import yaml
from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta


class XSocial:
    """Complete X (Twitter) management with brand integration"""
    
    def __init__(self, access_token: str, brand_config: Dict[str, Any]):
        self.access_token = access_token
        self.brand_config = brand_config
        self.base_url = "https://api.x.com/2"
        self.upload_url = "https://upload.x.com/1.1/media"
        
        # Extract Twitter/X specific config
        self.x_config = brand_config.get("platforms", {}).get("twitter", {})
        self.social_config = brand_config.get("social", {})
        self.voice_config = brand_config.get("voice", {})
        
        # Platform limits from brand config
        self.character_limit = self.x_config.get("max_chars", 280)
        self.hashtag_limit = self.x_config.get("hashtag_limit", 3)
        
        # Brand settings
        self.brand_topics = brand_config.get("topics", [])
        self.research_keywords = brand_config.get("research_keywords", [])
        
        # Headers
        self.headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json"
        }
    
    @classmethod
    def from_brand_file(cls, access_token: str, brand_file_path: str):
        """Create XSocial from brand YAML file"""
        with open(brand_file_path, 'r') as f:
            brand_config = yaml.safe_load(f)
        return cls(access_token, brand_config)
    
    # =============================================================================
    # CORE FUNCTIONALITY
    # =============================================================================
    
    async def health_check(self) -> Dict[str, Any]:
        """Check X API connection and get user info"""
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    f"{self.base_url}/users/me",
                    headers=self.headers
                ) as response:
                    if response.status == 200:
                        user_data = await response.json()
                        return {
                            "success": True,
                            "platform": "x",
                            "user_id": user_data.get("data", {}).get("id"),
                            "username": user_data.get("data", {}).get("username"),
                            "brand": self.brand_config.get("name"),
                            "handle": self.social_config.get("twitter_handle", ""),
                            "status": "connected"
                        }
                    else:
                        error_data = await response.json()
                        return {
                            "success": False,
                            "platform": "x",
                            "error": error_data.get("detail", "Authentication failed"),
                            "status_code": response.status
                        }
        except Exception as e:
            return {
                "success": False,
                "platform": "x",
                "error": str(e),
                "status": "connection_failed"
            }
    
    async def post_content(self, content: str, media_paths: List[str] = None, 
                          hashtags: List[str] = None, mentions: List[str] = None,
                          is_thread: bool = False) -> Dict[str, Any]:
        """Post content to X with brand-aware formatting"""
        try:
            # Format content according to brand guidelines
            formatted_content = self._format_content_for_brand(content, hashtags, mentions)
            
            # Determine if we need to post as thread
            if is_thread or len(formatted_content) > self.character_limit:
                return await self._post_thread(formatted_content, media_paths)
            else:
                return await self._post_single_tweet(formatted_content, media_paths)
                
        except Exception as e:
            return {
                "success": False,
                "platform": "x",
                "error": f"Posting failed: {str(e)}",
                "brand": self.brand_config.get("name")
            }
    
    # =============================================================================
    # POSTING METHODS
    # =============================================================================
    
    async def _post_single_tweet(self, content: str, media_paths: List[str] = None) -> Dict[str, Any]:
        """Post a single tweet"""
        try:
            post_data = {"text": content}
            
            # Upload media if provided
            if media_paths:
                media_ids = await self._upload_media_files(media_paths)
                if media_ids:
                    post_data["media"] = {"media_ids": media_ids}
            
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{self.base_url}/tweets",
                    headers=self.headers,
                    json=post_data
                ) as response:
                    response_data = await response.json()
                    
                    if response.status == 201:
                        tweet_data = response_data.get("data", {})
                        tweet_id = tweet_data.get("id")
                        
                        return {
                            "success": True,
                            "platform": "x",
                            "post_id": tweet_id,
                            "post_url": f"https://x.com/{self.social_config.get('twitter_handle', '').replace('@', '')}/status/{tweet_id}",
                            "content_length": len(content),
                            "media_count": len(media_paths) if media_paths else 0,
                            "brand": self.brand_config.get("name"),
                            "timestamp": datetime.now().isoformat()
                        }
                    else:
                        return {
                            "success": False,
                            "platform": "x",
                            "error": response_data.get("detail", "Unknown error"),
                            "status_code": response.status
                        }
                        
        except Exception as e:
            return {
                "success": False,
                "platform": "x",
                "error": f"Single tweet posting failed: {str(e)}"
            }
    
    async def _post_thread(self, content: str, media_paths: List[str] = None) -> Dict[str, Any]:
        """Post content as a thread"""
        try:
            # Split content into tweets
            tweets = self._split_into_tweets(content)
            
            thread_ids = []
            previous_id = None
            
            for i, tweet_content in enumerate(tweets):
                post_data = {"text": tweet_content}
                
                # Add media to first tweet only
                if i == 0 and media_paths:
                    media_ids = await self._upload_media_files(media_paths)
                    if media_ids:
                        post_data["media"] = {"media_ids": media_ids}
                
                # Add reply reference for thread continuation
                if previous_id:
                    post_data["reply"] = {"in_reply_to_tweet_id": previous_id}
                
                async with aiohttp.ClientSession() as session:
                    async with session.post(
                        f"{self.base_url}/tweets",
                        headers=self.headers,
                        json=post_data
                    ) as response:
                        response_data = await response.json()
                        
                        if response.status == 201:
                            tweet_id = response_data.get("data", {}).get("id")
                            thread_ids.append(tweet_id)
                            previous_id = tweet_id
                            
                            # Small delay between thread posts
                            if i < len(tweets) - 1:
                                await asyncio.sleep(2)
                        else:
                            return {
                                "success": False,
                                "platform": "x",
                                "error": f"Thread failed at tweet {i+1}: {response_data.get('detail', 'Unknown error')}",
                                "partial_thread_ids": thread_ids
                            }
            
            # Return thread result
            first_tweet_url = f"https://x.com/{self.social_config.get('twitter_handle', '').replace('@', '')}/status/{thread_ids[0]}"
            
            return {
                "success": True,
                "platform": "x",
                "post_type": "thread",
                "thread_ids": thread_ids,
                "first_post_id": thread_ids[0],
                "post_url": first_tweet_url,
                "total_tweets": len(thread_ids),
                "media_count": len(media_paths) if media_paths else 0,
                "brand": self.brand_config.get("name"),
                "timestamp": datetime.now().isoformat()
            }
            
        except Exception as e:
            return {
                "success": False,
                "platform": "x",
                "error": f"Thread posting failed: {str(e)}"
            }
    
    # =============================================================================
    # ENGAGEMENT METHODS
    # =============================================================================
    
    async def like_tweet(self, tweet_id: str) -> Dict[str, Any]:
        """Like a tweet"""
        try:
            user_id = await self._get_user_id()
            if not user_id:
                return {"success": False, "error": "Could not get user ID"}
            
            post_data = {"tweet_id": tweet_id}
            
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{self.base_url}/users/{user_id}/likes",
                    headers=self.headers,
                    json=post_data
                ) as response:
                    return {
                        "success": response.status == 200,
                        "platform": "x",
                        "action": "like",
                        "tweet_id": tweet_id,
                        "timestamp": datetime.now().isoformat()
                    }
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def retweet(self, tweet_id: str, comment: Optional[str] = None) -> Dict[str, Any]:
        """Retweet or quote tweet"""
        try:
            user_id = await self._get_user_id()
            if not user_id:
                return {"success": False, "error": "Could not get user ID"}
            
            if comment:
                # Quote tweet with comment
                formatted_comment = self._format_reply_for_brand(comment)
                post_data = {
                    "text": formatted_comment,
                    "quote_tweet_id": tweet_id
                }
                
                async with aiohttp.ClientSession() as session:
                    async with session.post(
                        f"{self.base_url}/tweets",
                        headers=self.headers,
                        json=post_data
                    ) as response:
                        response_data = await response.json()
                        
                        if response.status == 201:
                            new_tweet_id = response_data.get("data", {}).get("id")
                            return {
                                "success": True,
                                "platform": "x",
                                "action": "quote_tweet",
                                "original_tweet_id": tweet_id,
                                "new_tweet_id": new_tweet_id,
                                "comment": formatted_comment,
                                "timestamp": datetime.now().isoformat()
                            }
            else:
                # Simple retweet
                post_data = {"tweet_id": tweet_id}
                
                async with aiohttp.ClientSession() as session:
                    async with session.post(
                        f"{self.base_url}/users/{user_id}/retweets",
                        headers=self.headers,
                        json=post_data
                    ) as response:
                        return {
                            "success": response.status == 200,
                            "platform": "x",
                            "action": "retweet",
                            "tweet_id": tweet_id,
                            "timestamp": datetime.now().isoformat()
                        }
                        
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def auto_engage(self, keywords: List[str] = None, max_engagements: int = 10) -> Dict[str, Any]:
        """Automatically engage with relevant content"""
        try:
            if not keywords:
                keywords = self.research_keywords
            
            engagement_results = []
            total_engagements = 0
            
            for keyword in keywords:
                if total_engagements >= max_engagements:
                    break
                
                # Search for tweets
                search_results = await self._search_tweets(keyword, 10)
                
                if not search_results.get("success"):
                    continue
                
                tweets = search_results.get("tweets", [])
                
                for tweet in tweets:
                    if total_engagements >= max_engagements:
                        break
                    
                    tweet_id = tweet.get("id")
                    tweet_text = tweet.get("text", "")
                    
                    # Check if tweet is relevant to brand
                    if self._is_tweet_brand_relevant(tweet_text):
                        # Like the tweet
                        result = await self.like_tweet(tweet_id)
                        engagement_results.append({
                            **result,
                            "keyword": keyword,
                            "tweet_preview": tweet_text[:100] + "..." if len(tweet_text) > 100 else tweet_text
                        })
                        
                        if result.get("success"):
                            total_engagements += 1
                        
                        # Rate limiting
                        await asyncio.sleep(2)
                
                # Delay between keyword searches
                await asyncio.sleep(5)
            
            return {
                "success": True,
                "platform": "x",
                "brand": self.brand_config.get("name"),
                "total_engagements": total_engagements,
                "keywords_searched": keywords,
                "engagement_results": engagement_results,
                "timestamp": datetime.now().isoformat()
            }
            
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    # =============================================================================
    # ANALYTICS METHODS
    # =============================================================================
    
    async def get_tweet_metrics(self, tweet_id: str) -> Dict[str, Any]:
        """Get metrics for a specific tweet"""
        try:
            params = {
                "tweet.fields": "public_metrics,created_at,author_id",
                "expansions": "author_id"
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    f"{self.base_url}/tweets/{tweet_id}",
                    headers=self.headers,
                    params=params
                ) as response:
                    if response.status == 200:
                        data = await response.json()
                        tweet_data = data.get("data", {})
                        public_metrics = tweet_data.get("public_metrics", {})
                        
                        return {
                            "success": True,
                            "platform": "x",
                            "post_id": tweet_id,
                            "brand": self.brand_config.get("name"),
                            "metrics": {
                                "retweet_count": public_metrics.get("retweet_count", 0),
                                "like_count": public_metrics.get("like_count", 0),
                                "reply_count": public_metrics.get("reply_count", 0),
                                "quote_count": public_metrics.get("quote_count", 0),
                                "bookmark_count": public_metrics.get("bookmark_count", 0),
                                "impression_count": public_metrics.get("impression_count", 0)
                            },
                            "created_at": tweet_data.get("created_at"),
                            "engagement_rate": self._calculate_engagement_rate(public_metrics),
                            "timestamp": datetime.now().isoformat()
                        }
                    else:
                        return {
                            "success": False,
                            "platform": "x",
                            "error": f"Failed to get tweet metrics: {response.status}"
                        }
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def generate_analytics_report(self, time_range: str = "7d") -> Dict[str, Any]:
        """Generate comprehensive analytics report"""
        try:
            # Get account metrics
            account_metrics = await self._get_account_metrics()
            recent_performance = await self._get_recent_tweets_performance(20)
            
            # Extract key insights
            insights = []
            
            if account_metrics.get("success"):
                follower_count = account_metrics.get("account_metrics", {}).get("followers_count", 0)
                insights.append(f"Account has {follower_count:,} followers")
            
            if recent_performance.get("success"):
                avg_engagement = recent_performance.get("average_engagement_rate", 0)
                total_tweets = recent_performance.get("total_tweets", 0)
                insights.append(f"Average engagement rate: {avg_engagement}% over {total_tweets} recent tweets")
            
            return {
                "success": True,
                "platform": "x",
                "brand": self.brand_config.get("name"),
                "report_period": time_range,
                "account_metrics": account_metrics,
                "recent_performance": recent_performance,
                "key_insights": insights,
                "timestamp": datetime.now().isoformat()
            }
            
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    # =============================================================================
    # UTILITY METHODS
    # =============================================================================
    
    def _format_content_for_brand(self, content: str, hashtags: List[str] = None, 
                                 mentions: List[str] = None) -> str:
        """Format content according to brand voice and platform requirements"""
        # Use platform content template if available
        template = self.x_config.get("content_template", "{core_message}")
        
        # Apply template
        if "{core_message}" in template:
            formatted_content = template.replace("{core_message}", content)
        else:
            formatted_content = content
        
        # Add brand-appropriate hashtags
        if hashtags:
            brand_hashtags = self._select_brand_hashtags(hashtags)
            if brand_hashtags:
                hashtag_style = self.x_config.get("hashtag_style", "inline")
                if hashtag_style == "inline":
                    hashtag_text = " " + " ".join(f"#{tag}" for tag in brand_hashtags)
                    formatted_content += hashtag_text
        
        # Add mentions
        if mentions:
            mention_text = " " + " ".join(f"@{mention}" for mention in mentions)
            formatted_content += mention_text
        
        return formatted_content.strip()
    
    def _select_brand_hashtags(self, hashtags: List[str]) -> List[str]:
        """Select appropriate hashtags based on brand guidelines"""
        if not hashtags:
            return []
        
        # Limit hashtags according to brand config
        max_hashtags = self.hashtag_limit
        
        # Prioritize brand-relevant hashtags
        prioritized = []
        remaining = []
        
        for hashtag in hashtags:
            # Check if hashtag relates to brand topics
            is_brand_relevant = any(
                keyword.lower() in hashtag.lower() 
                for keyword in self.research_keywords + [topic.split()[0] for topic in self.brand_topics]
            )
            
            if is_brand_relevant:
                prioritized.append(hashtag)
            else:
                remaining.append(hashtag)
        
        # Select up to limit, prioritizing brand-relevant hashtags
        selected = prioritized[:max_hashtags] + remaining[:max(0, max_hashtags - len(prioritized))]
        return selected[:max_hashtags]
    
    def _split_into_tweets(self, text: str) -> List[str]:
        """Split long content into tweets respecting character limits"""
        if len(text) <= self.character_limit:
            return [text]
        
        # Split by sentences first
        sentences = [s.strip() + '.' for s in text.split('.') if s.strip()]
        tweets = []
        current_tweet = ""
        
        for sentence in sentences:
            # Check if adding this sentence exceeds limit
            test_tweet = current_tweet + (" " if current_tweet else "") + sentence
            
            if len(test_tweet) <= self.character_limit:
                current_tweet = test_tweet
            else:
                # Save current tweet and start new one
                if current_tweet:
                    tweets.append(current_tweet)
                current_tweet = sentence
                
                # If single sentence is too long, truncate
                if len(current_tweet) > self.character_limit:
                    current_tweet = current_tweet[:self.character_limit-3] + "..."
        
        # Add final tweet
        if current_tweet:
            tweets.append(current_tweet)
        
        return tweets
    
    def _format_reply_for_brand(self, reply_text: str) -> str:
        """Format reply according to brand voice guidelines"""
        attributes = self.voice_config.get("attributes", [])
        
        # Add empathetic language if it's the GiveCare brand
        if "empathetic" in attributes and self.brand_config.get("name") == "GiveCare":
            # Ensure reply sounds supportive for caregiver content
            if len(reply_text) < 200:  # Leave room for supportive language
                reply_text = f"Thank you for sharing this. {reply_text}"
        
        return reply_text
    
    def _is_tweet_brand_relevant(self, tweet_text: str) -> bool:
        """Check if tweet is relevant to brand topics"""
        tweet_lower = tweet_text.lower()
        
        # Check against brand topics
        for topic in self.brand_topics:
            topic_keywords = topic.lower().split()
            if any(keyword in tweet_lower for keyword in topic_keywords):
                return True
        
        # Check against research keywords
        for keyword in self.research_keywords:
            if keyword.lower() in tweet_lower:
                return True
        
        return False
    
    def _calculate_engagement_rate(self, metrics: Dict[str, int]) -> float:
        """Calculate engagement rate from public metrics"""
        total_engagements = (
            metrics.get("retweet_count", 0) +
            metrics.get("like_count", 0) +
            metrics.get("reply_count", 0) +
            metrics.get("quote_count", 0)
        )
        
        impressions = metrics.get("impression_count", 0)
        if impressions > 0:
            return round((total_engagements / impressions) * 100, 2)
        return 0.0
    
    async def _upload_media_files(self, media_paths: List[str]) -> List[str]:
        """Upload media files and return media IDs"""
        media_ids = []
        
        for media_path in media_paths:
            if not os.path.exists(media_path):
                print(f"⚠️ Media file not found: {media_path}")
                continue
            
            media_id = await self._upload_single_media(media_path)
            if media_id:
                media_ids.append(media_id)
            
            # Rate limiting - small delay between uploads
            await asyncio.sleep(1)
        
        return media_ids
    
    async def _upload_single_media(self, media_path: str) -> Optional[str]:
        """Upload a single media file"""
        try:
            # Validate file size and type
            file_size = os.path.getsize(media_path)
            max_size = 5 * 1024 * 1024  # 5MB for images
            
            if file_size > max_size:
                print(f"⚠️ Media file too large: {media_path} ({file_size} bytes)")
                return None
            
            media_type = self._get_media_type(media_path)
            if not media_type:
                print(f"⚠️ Unsupported media type: {media_path}")
                return None
            
            # Upload headers
            upload_headers = {
                "Authorization": f"Bearer {self.access_token}"
            }
            
            with open(media_path, 'rb') as media_file:
                media_data = media_file.read()
            
            async with aiohttp.ClientSession() as session:
                form_data = aiohttp.FormData()
                form_data.add_field('media', media_data, 
                                  filename=os.path.basename(media_path),
                                  content_type=media_type)
                
                async with session.post(
                    f"{self.upload_url}/upload.json",
                    headers=upload_headers,
                    data=form_data
                ) as response:
                    if response.status == 200:
                        upload_data = await response.json()
                        return upload_data.get("media_id_string")
                    else:
                        error_data = await response.json()
                        print(f"❌ Media upload failed: {error_data}")
                        return None
                        
        except Exception as e:
            print(f"❌ Media upload error: {e}")
            return None
    
    def _get_media_type(self, media_path: str) -> Optional[str]:
        """Get MIME type from file extension"""
        ext = os.path.splitext(media_path)[1].lower()
        media_types = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg', 
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.webp': 'image/webp',
            '.mp4': 'video/mp4',
            '.mov': 'video/quicktime'
        }
        return media_types.get(ext)
    
    async def _get_user_id(self) -> Optional[str]:
        """Get current user ID"""
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    f"{self.base_url}/users/me",
                    headers=self.headers
                ) as response:
                    if response.status == 200:
                        data = await response.json()
                        return data.get("data", {}).get("id")
        except Exception as e:
            print(f"Error getting user ID: {e}")
        return None
    
    async def _search_tweets(self, query: str, max_results: int = 10) -> Dict[str, Any]:
        """Search for tweets"""
        try:
            params = {
                "query": query,
                "max_results": min(max_results, 100),
                "tweet.fields": "created_at,public_metrics,author_id,lang",
                "expansions": "author_id"
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    f"{self.base_url}/tweets/search/recent",
                    headers=self.headers,
                    params=params
                ) as response:
                    if response.status == 200:
                        data = await response.json()
                        tweets = data.get("data", [])
                        
                        # Filter tweets (only English, not too old)
                        filtered_tweets = []
                        for tweet in tweets:
                            if tweet.get("lang") == "en":
                                # Check if tweet is recent (within 24 hours)
                                created_at = datetime.fromisoformat(tweet.get("created_at", "").replace("Z", "+00:00"))
                                if (datetime.now() - created_at.replace(tzinfo=None)).days < 1:
                                    filtered_tweets.append(tweet)
                        
                        return {
                            "success": True,
                            "tweets": filtered_tweets,
                            "total_found": len(tweets),
                            "filtered_count": len(filtered_tweets)
                        }
                    else:
                        return {
                            "success": False,
                            "error": f"Search failed: {response.status}"
                        }
        except Exception as e:
            return {
                "success": False,
                "error": f"Search error: {str(e)}"
            }
    
    async def _get_account_metrics(self) -> Dict[str, Any]:
        """Get account-level metrics"""
        try:
            # Get user info with public metrics
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    f"{self.base_url}/users/me",
                    headers=self.headers,
                    params={"user.fields": "public_metrics,created_at,verified"}
                ) as response:
                    if response.status == 200:
                        data = await response.json()
                        user_data = data.get("data", {})
                        public_metrics = user_data.get("public_metrics", {})
                        
                        return {
                            "success": True,
                            "platform": "x",
                            "brand": self.brand_config.get("name"),
                            "account_metrics": {
                                "followers_count": public_metrics.get("followers_count", 0),
                                "following_count": public_metrics.get("following_count", 0),
                                "tweet_count": public_metrics.get("tweet_count", 0),
                                "listed_count": public_metrics.get("listed_count", 0),
                                "like_count": public_metrics.get("like_count", 0)
                            },
                            "account_info": {
                                "username": user_data.get("username"),
                                "name": user_data.get("name"),
                                "verified": user_data.get("verified", False),
                                "created_at": user_data.get("created_at")
                            },
                            "timestamp": datetime.now().isoformat()
                        }
                    else:
                        return {
                            "success": False,
                            "platform": "x",
                            "error": f"Failed to get account metrics: {response.status}"
                        }
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def _get_recent_tweets_performance(self, max_results: int = 10) -> Dict[str, Any]:
        """Get performance metrics for recent tweets"""
        try:
            # Get recent tweets from account
            user_id = await self._get_user_id()
            if not user_id:
                return {"success": False, "error": "Could not get user ID"}
            
            params = {
                "max_results": min(max_results, 100),
                "tweet.fields": "public_metrics,created_at,text",
                "exclude": "retweets,replies"
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    f"{self.base_url}/users/{user_id}/tweets",
                    headers=self.headers,
                    params=params
                ) as response:
                    if response.status == 200:
                        data = await response.json()
                        tweets = data.get("data", [])
                        
                        performance_data = []
                        total_engagement = 0
                        total_impressions = 0
                        
                        for tweet in tweets:
                            metrics = tweet.get("public_metrics", {})
                            engagement = (
                                metrics.get("retweet_count", 0) +
                                metrics.get("like_count", 0) +
                                metrics.get("reply_count", 0) +
                                metrics.get("quote_count", 0)
                            )
                            impressions = metrics.get("impression_count", 0)
                            
                            total_engagement += engagement
                            total_impressions += impressions
                            
                            performance_data.append({
                                "tweet_id": tweet.get("id"),
                                "text_preview": tweet.get("text", "")[:100] + "..." if len(tweet.get("text", "")) > 100 else tweet.get("text", ""),
                                "created_at": tweet.get("created_at"),
                                "metrics": metrics,
                                "engagement_rate": self._calculate_engagement_rate(metrics)
                            })
                        
                        # Calculate overall performance
                        avg_engagement_rate = 0.0
                        if total_impressions > 0:
                            avg_engagement_rate = round((total_engagement / total_impressions) * 100, 2)
                        
                        return {
                            "success": True,
                            "platform": "x",
                            "brand": self.brand_config.get("name"),
                            "total_tweets": len(tweets),
                            "total_engagement": total_engagement,
                            "total_impressions": total_impressions,
                            "average_engagement_rate": avg_engagement_rate,
                            "tweets_performance": performance_data,
                            "timestamp": datetime.now().isoformat()
                        }
                    else:
                        return {"success": False, "error": f"Failed to get tweets: {response.status}"}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    # =============================================================================
    # PUBLIC API METHODS
    # =============================================================================
    
    def get_brand_voice_summary(self) -> Dict[str, Any]:
        """Get brand voice configuration for X"""
        return {
            "brand_name": self.brand_config.get("name"),
            "tone": self.voice_config.get("tone"),
            "style": self.voice_config.get("style"),
            "attributes": self.voice_config.get("attributes", []),
            "platform": "x",
            "character_limit": self.character_limit,
            "hashtag_limit": self.hashtag_limit
        }
    
    def get_optimal_posting_times(self) -> List[str]:
        """Get optimal posting times from brand config"""
        return self.x_config.get("optimal_times", ["9am", "12pm", "5pm"])
    
    async def delete_tweet(self, tweet_id: str) -> Dict[str, Any]:
        """Delete a tweet"""
        try:
            async with aiohttp.ClientSession() as session:
                async with session.delete(
                    f"{self.base_url}/tweets/{tweet_id}",
                    headers=self.headers
                ) as response:
                    success = response.status == 200
                    return {
                        "success": success,
                        "platform": "x",
                        "action": "delete",
                        "post_id": tweet_id,
                        "brand": self.brand_config.get("name")
                    }
        except Exception as e:
            return {"success": False, "error": str(e)}