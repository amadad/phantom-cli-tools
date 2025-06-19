#!/usr/bin/env python3
"""
Slack Approval Workflow for GiveCare
Interactive approval system with buttons and content preview.
"""

import os
import json
import asyncio
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, Optional
from slack_sdk.web.async_client import AsyncWebClient

# ============================================================================
# SLACK APPROVAL SYSTEM
# ============================================================================

class SlackApprovalWorkflow:
    """Simple Slack approval workflow for social media content."""
    
    def __init__(self):
        self.slack_token = os.getenv("SLACK_BOT_TOKEN")
        self.channel = os.getenv("SLACK_APPROVAL_CHANNEL", "#general")
        self.client = AsyncWebClient(token=self.slack_token) if self.slack_token else None
    
    async def request_approval(
        self, 
        content: Dict[str, Any], 
        platform: str,
        brand_config: Dict[str, Any],
        content_file: Optional[str] = None
    ) -> bool:
        """Send approval request to Slack with interactive buttons."""
        
        if not self.client:
            print("⚠️ Slack not configured, falling back to terminal approval")
            return self._terminal_approval(content, platform)
        
        try:
            # Save content to file for reference
            if not content_file:
                content_file = self._save_content_for_approval(content, platform, brand_config)
            
            # Create approval message
            blocks = self._create_approval_blocks(content, platform, brand_config, content_file)
            
            # Send to Slack
            brand_name = brand_config.get("name", "Brand")
            await self.client.chat_postMessage(
                channel=self.channel,
                text=f"{brand_name} {platform.upper()} post approval required",
                blocks=blocks
            )
            
            print(f"📱 Slack approval request sent for {platform.upper()}")
            print(f"💾 Content saved to: {content_file}")
            print(f"⏳ Waiting for approval in {self.channel}...")
            
            # For now, auto-approve (in production, this would wait for webhook)
            print("✅ Auto-approved for demo (implement webhook handler for production)")
            return True
            
        except Exception as e:
            print(f"❌ Slack approval failed: {e}")
            return self._terminal_approval(content, platform)
    
    def _create_approval_blocks(
        self, 
        content: Dict[str, Any], 
        platform: str,
        brand_config: Dict[str, Any],
        content_file: str
    ) -> list:
        """Create Slack blocks for approval message."""
        
        # Extract content preview
        content_text = content.get("content", "No content")
        preview = content_text[:400] + ("..." if len(content_text) > 400 else "")
        
        # Media info
        media_info = []
        if content.get("image_path"):
            media_info.append(f"📸 Image: {Path(content['image_path']).name}")
        if content.get("video_path"):
            media_info.append(f"🎬 Video: {Path(content['video_path']).name}")
        if content.get("audio_path"):
            media_info.append(f"🎵 Audio: {Path(content['audio_path']).name}")
        
        media_text = "\n".join(media_info) if media_info else "No media"
        
        brand_name = brand_config.get("name", "Brand")
        
        blocks = [
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f":warning: *{brand_name} - {platform.upper()} POST APPROVAL REQUIRED*"
                }
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*Content Preview:*\n```{preview}```"
                }
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*Media:*\n{media_text}"
                }
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*File:* `{content_file}`"
                }
            },
            {
                "type": "actions",
                "elements": [
                    {
                        "type": "button",
                        "text": {"type": "plain_text", "text": "✅ Approve & Post"},
                        "style": "primary",
                        "action_id": "approve_post",
                        "value": content_file
                    },
                    {
                        "type": "button", 
                        "text": {"type": "plain_text", "text": "❌ Reject"},
                        "style": "danger",
                        "action_id": "reject_post",
                        "value": content_file
                    },
                    {
                        "type": "button",
                        "text": {"type": "plain_text", "text": "✏️ Edit"},
                        "action_id": "edit_post",
                        "value": content_file
                    }
                ]
            }
        ]
        
        return blocks
    
    def _save_content_for_approval(self, content: Dict[str, Any], platform: str, brand_config: Dict[str, Any]) -> str:
        """Save content to file for approval reference."""
        try:
            # Create approval directory
            approval_dir = Path("output/pending_approval")
            approval_dir.mkdir(parents=True, exist_ok=True)
            
            # Generate filename
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            brand_name = brand_config.get("name", "brand").lower().replace(" ", "_")
            filename = f"{brand_name}_{platform}_{timestamp}.json"
            filepath = approval_dir / filename
            
            # Save content with metadata
            approval_data = {
                "brand": brand_config.get("name", "Brand"),
                "platform": platform,
                "timestamp": timestamp,
                "content": content,
                "status": "pending_approval",
                "created_at": datetime.now().isoformat()
            }
            
            with open(filepath, 'w') as f:
                json.dump(approval_data, f, indent=2, default=str)
            
            return str(filepath)
            
        except Exception as e:
            print(f"❌ Failed to save content for approval: {e}")
            return f"error_saving_{platform}_{timestamp}"
    
    def _terminal_approval(self, content: Dict[str, Any], platform: str) -> bool:
        """Fallback terminal approval when Slack isn't available."""
        print(f"\n🚨 {platform.upper()} POST APPROVAL REQUIRED")
        print("=" * 50)
        print(f"Content: {content.get('content', 'No content')}")
        print(f"Hashtags: {content.get('hashtags', [])}")
        
        if content.get("image_path"):
            print(f"Image: {content['image_path']}")
        if content.get("video_path"):
            print(f"Video: {content['video_path']}")
        if content.get("audio_path"):
            print(f"Audio: {content['audio_path']}")
        
        print("=" * 50)
        
        while True:
            response = input("Approve this post? (y/n/e for edit): ").lower().strip()
            if response in ['y', 'yes']:
                print("✅ Approved")
                return True
            elif response in ['n', 'no']:
                print("❌ Rejected")
                return False
            elif response in ['e', 'edit']:
                print("✏️ Edit mode not implemented in terminal")
                continue
            else:
                print("Please enter 'y' for yes, 'n' for no, or 'e' for edit")

# ============================================================================
# APPROVAL UTILITIES
# ============================================================================

def load_pending_approval(filepath: str) -> Optional[Dict[str, Any]]:
    """Load content from pending approval file."""
    try:
        with open(filepath, 'r') as f:
            return json.load(f)
    except Exception as e:
        print(f"❌ Failed to load approval content: {e}")
        return None

def mark_approval_status(filepath: str, status: str, result: Optional[Dict] = None):
    """Mark approval status in the content file."""
    try:
        data = load_pending_approval(filepath)
        if data:
            data["status"] = status
            data["processed_at"] = datetime.now().isoformat()
            if result:
                data["post_result"] = result
            
            with open(filepath, 'w') as f:
                json.dump(data, f, indent=2, default=str)
                
    except Exception as e:
        print(f"❌ Failed to update approval status: {e}")

def cleanup_old_approvals(days_old: int = 7):
    """Clean up old approval files."""
    try:
        approval_dir = Path("output/pending_approval")
        if not approval_dir.exists():
            return
        
        import time
        cutoff_time = time.time() - (days_old * 24 * 60 * 60)
        
        for file_path in approval_dir.glob("*.json"):
            if file_path.stat().st_mtime < cutoff_time:
                file_path.unlink()
                print(f"🗑️ Cleaned up old approval: {file_path.name}")
                
    except Exception as e:
        print(f"❌ Cleanup failed: {e}")

# ============================================================================
# TESTING
# ============================================================================

async def test_slack_approval():
    """Test Slack approval workflow with brand configuration."""
    print("🧪 Testing brand-agnostic Slack approval workflow...")
    
    # Load brand config
    import yaml
    try:
        with open("brand/givecare.yml", 'r') as f:
            brand_config = yaml.safe_load(f)
    except:
        brand_config = {
            "name": "TestBrand",
            "voice_tone": "professional and friendly"
        }
    
    workflow = SlackApprovalWorkflow()
    
    # Test content
    test_content = {
        "content": "Family caregivers often experience burnout during the holidays. Remember: self-care isn't selfish—it's essential. Take breaks, ask for help, and prioritize your well-being. #CaregiverSupport #SelfCare",
        "hashtags": ["CaregiverSupport", "SelfCare", "HolidayStress"],
        "image_path": "output/test_image.png",
        "platform": "twitter"
    }
    
    approved = await workflow.request_approval(test_content, "twitter", brand_config)
    print(f"📊 Test result for {brand_config['name']}: {'Approved' if approved else 'Rejected'}")

if __name__ == "__main__":
    asyncio.run(test_slack_approval())