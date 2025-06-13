# services/slack_service.py
import logging
from typing import Optional, Dict, Any
from slack_sdk.web.async_client import AsyncWebClient
from slack_sdk.errors import SlackApiError
from utils.config import settings
import backoff

logger = logging.getLogger(__name__)

class SlackService:
    """Simplified service for Slack approval workflow."""
    
    def __init__(self):
        self.client = AsyncWebClient(token=settings.SLACK_BOT_TOKEN)
        self.approval_channel = settings.SLACK_APPROVAL_CHANNEL
        logger.info("Initialized SlackService")
    
    @backoff.on_exception(backoff.expo, SlackApiError, max_tries=3)
    async def post_approval(
        self, 
        title: str, 
        text: str, 
        image_url: Optional[str] = None
    ) -> Dict[str, Any]:
        """Post content for approval with approve/reject buttons."""
        blocks = [
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*New Content for Approval*\n*Title:* {title}\n\n{text}"
                }
            },
            {
                "type": "actions",
                "elements": [
                    {
                        "type": "button",
                        "text": {"type": "plain_text", "text": "Approve"},
                        "style": "primary",
                        "value": "approve",
                        "action_id": "approve_content"
                    },
                    {
                        "type": "button",
                        "text": {"type": "plain_text", "text": "Reject"},
                        "style": "danger", 
                        "value": "reject",
                        "action_id": "reject_content"
                    }
                ]
            }
        ]
        
        if image_url:
            blocks.insert(1, {
                "type": "image",
                "image_url": image_url,
                "alt_text": "Preview image"
            })
        
        try:
            response = await self.client.chat_postMessage(
                channel=self.approval_channel,
                text=f"New content for approval: {title}",
                blocks=blocks
            )
            return response.data
        except SlackApiError as e:
            logger.error(f"Error posting to Slack: {e.response['error']}")
            raise