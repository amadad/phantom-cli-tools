"""SlackService: minimal helper for posting approval requests."""
import os
from slack_sdk import WebClient
from slack_sdk.errors import SlackApiError

class SlackService:
    def __init__(self):
        self.client = WebClient(token=os.getenv("SLACK_BOT_TOKEN"))
        self.channel = os.getenv("SLACK_APPROVAL_CHANNEL", "#general")

    async def post_approval(self, title: str, text: str, url: str) -> bool:
        blocks = [
            {"type": "section", "text": {"type": "mrkdwn", "text": f"*{title}*\n{text}"}},
            {"type": "image", "image_url": url, "alt_text": title},
        ]
        try:
            self.client.chat_postMessage(channel=self.channel, text=title, blocks=blocks)
            return True
        except SlackApiError as e:
            print("Slack error", e)
            return False
