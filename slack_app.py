#!/usr/bin/env python3
"""
Slack App for Agent Social Pipeline
Handles interactive approval workflow and slash commands.
"""

import asyncio
import json
import logging
from pathlib import Path
from slack_bolt.async_app import AsyncApp
from slack_bolt.adapter.socket_mode.async_handler import AsyncSocketModeHandler

# Import from consolidated pipeline
from social_pipeline import SocialPipeline, settings
from config import settings as config_settings

logger = logging.getLogger(__name__)

# Initialize Slack Bolt app
slack_app = AsyncApp(token=settings.SLACK_BOT_TOKEN)

# Pipeline state management
PIPELINE_STATE_FILE = Path("pipeline_state.json")

def get_pipeline_state():
    """Get current pipeline state (active/paused)."""
    if PIPELINE_STATE_FILE.exists():
        with open(PIPELINE_STATE_FILE, 'r') as f:
            return json.load(f).get('status', 'active')
    return 'active'

def set_pipeline_state(status: str):
    """Set pipeline state (active/paused)."""
    state = {'status': status, 'updated_at': str(asyncio.get_event_loop().time())}
    with open(PIPELINE_STATE_FILE, 'w') as f:
        json.dump(state, f)
    logger.info(f"Pipeline state set to: {status}")

# Slack Bolt event handlers for approval interactions
@slack_app.action("approve_content")
async def handle_approve_content(ack, body, logger):
    """Handle content approval button clicks."""
    await ack()
    
    try:
        # Get the pipeline's slack service to handle the action
        pipeline = SocialPipeline()
        response = await pipeline.slack.handle_approval_action(body)
        
        # Send ephemeral response to user
        await slack_app.client.chat_postEphemeral(
            channel=body["channel"]["id"],
            user=body["user"]["id"],
            text=response["text"]
        )
        
        logger.info(f"Processed approval action: {body['actions'][0]['value']}")
        
    except Exception as e:
        logger.error(f"Error handling approval action: {e}")
        await slack_app.client.chat_postEphemeral(
            channel=body["channel"]["id"],
            user=body["user"]["id"],
            text=f"❌ Error processing approval: {str(e)}"
        )

@slack_app.action("reject_content")
async def handle_reject_content(ack, body, logger):
    """Handle content rejection button clicks."""
    await ack()
    
    try:
        pipeline = SocialPipeline()
        response = await pipeline.slack.handle_approval_action(body)
        
        await slack_app.client.chat_postEphemeral(
            channel=body["channel"]["id"],
            user=body["user"]["id"],
            text=response["text"]
        )
        
        logger.info(f"Processed rejection action: {body['actions'][0]['value']}")
        
    except Exception as e:
        logger.error(f"Error handling rejection action: {e}")
        await slack_app.client.chat_postEphemeral(
            channel=body["channel"]["id"],
            user=body["user"]["id"],
            text=f"❌ Error processing rejection: {str(e)}"
        )

# Slack command handlers
@slack_app.command("/pipeline")
async def handle_pipeline_command(ack, body, logger):
    """Handle /pipeline slash command."""
    await ack()
    
    command_text = body.get("text", "").strip().lower()
    user_id = body["user_id"]
    channel_id = body["channel_id"]
    
    try:
        if command_text == "status":
            state = get_pipeline_state()
            await slack_app.client.chat_postEphemeral(
                channel=channel_id,
                user=user_id,
                text=f"📊 Pipeline Status: *{state.upper()}*"
            )
            
        elif command_text == "pause":
            set_pipeline_state("paused")
            await slack_app.client.chat_postEphemeral(
                channel=channel_id,
                user=user_id,
                text="⏸️ Pipeline paused. Use `/pipeline resume` to resume."
            )
            
        elif command_text == "resume":
            set_pipeline_state("active")
            await slack_app.client.chat_postEphemeral(
                channel=channel_id,
                user=user_id,
                text="▶️ Pipeline resumed and active."
            )
            
        elif command_text.startswith("run "):
            topic = command_text[4:].strip()
            if not topic:
                await slack_app.client.chat_postEphemeral(
                    channel=channel_id,
                    user=user_id,
                    text="❌ Please provide a topic. Usage: `/pipeline run <topic>`"
                )
                return
            
            # Start pipeline execution
            await slack_app.client.chat_postEphemeral(
                channel=channel_id,
                user=user_id,
                text=f"🚀 Starting pipeline for topic: *{topic}*"
            )
            
            # Run pipeline in background
            asyncio.create_task(run_pipeline_background(topic, channel_id))
            
        else:
            help_text = """
*Pipeline Commands:*
• `/pipeline status` - Check pipeline status
• `/pipeline pause` - Pause the pipeline
• `/pipeline resume` - Resume the pipeline
• `/pipeline run <topic>` - Run pipeline for a specific topic

*Examples:*
• `/pipeline run caregiver burnout`
• `/pipeline run mental health awareness`
            """
            await slack_app.client.chat_postEphemeral(
                channel=channel_id,
                user=user_id,
                text=help_text
            )
            
    except Exception as e:
        logger.error(f"Error handling pipeline command: {e}")
        await slack_app.client.chat_postEphemeral(
            channel=channel_id,
            user=user_id,
            text=f"❌ Error: {str(e)}"
        )

async def run_pipeline_background(topic: str, channel_id: str):
    """Run pipeline in background and post updates to Slack."""
    try:
        pipeline = SocialPipeline()
        
        # Send initial status
        await slack_app.client.chat_postMessage(
            channel=channel_id,
            text=f"🔄 Starting content pipeline for: *{topic}*"
        )
        
        # Execute pipeline
        final_result = None
        async for response in pipeline.run(topic=topic, auto_post=False):
            content = response.content
            
            if isinstance(content, dict):
                step = content.get("step", "unknown")
                message = content.get("message", "Processing...")
                
                # Post step updates
                if step in ["searching", "creating_content", "generating_media", "posting"]:
                    await slack_app.client.chat_postMessage(
                        channel=channel_id,
                        text=f"📝 {message}"
                    )
                elif step == "approval_sent":
                    approval_id = content.get("approval_id")
                    await slack_app.client.chat_postMessage(
                        channel=channel_id,
                        text=f"📋 {message}\n*Approval ID:* `{approval_id}`"
                    )
                elif step == "approved":
                    await slack_app.client.chat_postMessage(
                        channel=channel_id,
                        text="✅ Content approved! Proceeding with posting..."
                    )
                
                # Check if this is the final result
                if content.get("status") in ["success", "rejected", "timeout", "error"]:
                    final_result = content
                    break
        
        # Post final result
        if final_result:
            status = final_result.get("status", "unknown")
            message = final_result.get("message", "Pipeline completed")
            
            if status == "success":
                posting_results = final_result.get("posting_results", [])
                platforms_posted = [r["platform"] for r in posting_results if r["status"] == "success"]
                
                await slack_app.client.chat_postMessage(
                    channel=channel_id,
                    text=f"🎉 *Pipeline Completed Successfully!*\n"
                         f"📱 Posted to: {', '.join(platforms_posted) if platforms_posted else 'No platforms'}\n"
                         f"💬 {message}"
                )
            else:
                await slack_app.client.chat_postMessage(
                    channel=channel_id,
                    text=f"❌ *Pipeline {status.upper()}*\n💬 {message}"
                )
        
    except Exception as e:
        logger.error(f"Error in background pipeline execution: {e}")
        await slack_app.client.chat_postMessage(
            channel=channel_id,
            text=f"❌ Pipeline error: {str(e)}"
        )

async def start_slack_app():
    """Start the Slack app with Socket Mode."""
    try:
        # Start Slack Bolt app
        handler = AsyncSocketModeHandler(slack_app, settings.SLACK_APP_TOKEN)
        
        logger.info("🚀 Starting Slack app with approval workflow...")
        await handler.start_async()
        
    except Exception as e:
        logger.error(f"Error starting Slack app: {e}")
        raise

if __name__ == "__main__":
    # Configure logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    # Start the Slack app
    asyncio.run(start_slack_app())