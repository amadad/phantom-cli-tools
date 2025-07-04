#!/usr/bin/env python3
"""
Telegram Approval Workflow for Agent Social
Simple, reliable approval system using long polling and inline keyboards.
"""

import os
import json
import asyncio
from pathlib import Path
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, Tuple
from enum import Enum

# Telegram imports
try:
    from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update
    from telegram.ext import Application, CommandHandler, CallbackQueryHandler, ContextTypes
except ImportError:
    print("⚠️ python-telegram-bot not installed. Run: pip install python-telegram-bot")
    raise


class ApprovalStatus(Enum):
    """Approval status enum."""
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    EDITED = "edited"
    TIMEOUT = "timeout"


class TelegramApprovalWorkflow:
    """Simple Telegram approval workflow for social media content."""
    
    def __init__(self):
        self.bot_token = os.getenv("TELEGRAM_BOT_TOKEN")
        self.chat_id = os.getenv("TELEGRAM_CHAT_ID")  # Your Telegram user/group ID
        self.timeout_minutes = int(os.getenv("APPROVAL_TIMEOUT_MINUTES", "30"))
        self.storage_dir = Path("/tmp/telegram_approvals")
        self.storage_dir.mkdir(exist_ok=True)
        
        # Initialize bot application
        self.app = None
        if self.bot_token:
            self.app = Application.builder().token(self.bot_token).build()
            
            # Add handlers
            self.app.add_handler(CallbackQueryHandler(self._handle_callback))
            self.app.add_handler(CommandHandler("status", self._status_command))
    
    async def request_approval(
        self, 
        content: Dict[str, Any], 
        platform: str,
        brand_config: Dict[str, Any],
    ) -> bool:
        """Send approval request to Telegram with inline keyboard."""
        
        if not self.app or not self.chat_id:
            print("⚠️ Telegram not configured, falling back to terminal approval")
            return await self._terminal_approval(content, platform)
        
        try:
            # Generate unique approval ID
            approval_id = f"{platform}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
            
            # Save content for reference
            self._save_pending_approval(approval_id, content, platform, brand_config)
            
            # Create message
            message_text = self._format_approval_message(content, platform, brand_config)
            
            # Create inline keyboard
            keyboard = [
                [
                    InlineKeyboardButton("✅ Approve", callback_data=f"approve_{approval_id}"),
                    InlineKeyboardButton("❌ Reject", callback_data=f"reject_{approval_id}"),
                ],
                [
                    InlineKeyboardButton("✏️ Edit", callback_data=f"edit_{approval_id}"),
                    InlineKeyboardButton("📋 View Full", callback_data=f"view_{approval_id}"),
                ]
            ]
            reply_markup = InlineKeyboardMarkup(keyboard)
            
            # Send message
            message = await self.app.bot.send_message(
                chat_id=self.chat_id,
                text=message_text,
                reply_markup=reply_markup,
                parse_mode="Markdown"
            )
            
            # If there's an image, send it too
            if content.get("image_url"):
                await self.app.bot.send_photo(
                    chat_id=self.chat_id,
                    photo=content["image_url"],
                    caption=f"Image for {platform} post"
                )
            
            print(f"📱 Telegram approval request sent (ID: {approval_id})")
            print(f"⏳ Waiting for approval (timeout: {self.timeout_minutes} minutes)...")
            
            # Start polling in background
            asyncio.create_task(self._start_polling())
            
            # Wait for approval with timeout
            return await self._wait_for_approval(approval_id)
            
        except Exception as e:
            print(f"❌ Telegram approval failed: {e}")
            return await self._terminal_approval(content, platform)
    
    def _format_approval_message(
        self, 
        content: Dict[str, Any], 
        platform: str,
        brand_config: Dict[str, Any]
    ) -> str:
        """Format content for Telegram message."""
        
        brand_name = brand_config.get("name", "Brand")
        content_text = content.get("content", "No content")
        
        # Truncate for preview
        preview = content_text[:500] + ("..." if len(content_text) > 500 else "")
        
        # Character count
        char_count = len(content_text)
        platform_config = brand_config.get("platforms", {}).get(platform, {})
        max_chars = platform_config.get("max_chars", 0)
        
        message = f"""🚨 *{brand_name} - {platform.upper()} Post Approval*

📝 *Content Preview:*
```
{preview}
```

📊 *Stats:*
• Platform: {platform}
• Characters: {char_count}/{max_chars}
• Has Image: {"Yes" if content.get("image_url") else "No"}

⏰ *Expires in {self.timeout_minutes} minutes*
"""
        
        return message
    
    def _save_pending_approval(
        self, 
        approval_id: str, 
        content: Dict[str, Any],
        platform: str,
        brand_config: Dict[str, Any]
    ):
        """Save pending approval to file."""
        
        approval_data = {
            "id": approval_id,
            "content": content,
            "platform": platform,
            "brand": brand_config.get("name", "Unknown"),
            "status": ApprovalStatus.PENDING.value,
            "created_at": datetime.now().isoformat(),
            "expires_at": (datetime.now() + timedelta(minutes=self.timeout_minutes)).isoformat()
        }
        
        filepath = self.storage_dir / f"{approval_id}.json"
        with open(filepath, "w") as f:
            json.dump(approval_data, f, indent=2)
    
    async def _wait_for_approval(self, approval_id: str) -> bool:
        """Wait for approval decision with timeout."""
        
        timeout = datetime.now() + timedelta(minutes=self.timeout_minutes)
        check_interval = 2  # seconds
        
        while datetime.now() < timeout:
            # Check approval status
            approval_data = self._load_approval(approval_id)
            if not approval_data:
                return False
            
            status = approval_data.get("status")
            
            if status == ApprovalStatus.APPROVED.value:
                print("✅ Content approved!")
                return True
            elif status == ApprovalStatus.REJECTED.value:
                print("❌ Content rejected!")
                return False
            elif status == ApprovalStatus.EDITED.value:
                print("✏️ Content edited - using updated version")
                # Update content with edited version
                return True
            
            # Still pending, wait
            await asyncio.sleep(check_interval)
        
        # Timeout
        print("⏱️ Approval timeout reached")
        self._update_approval_status(approval_id, ApprovalStatus.TIMEOUT)
        return False
    
    def _load_approval(self, approval_id: str) -> Optional[Dict[str, Any]]:
        """Load approval data from file."""
        
        filepath = self.storage_dir / f"{approval_id}.json"
        if not filepath.exists():
            return None
        
        with open(filepath, "r") as f:
            return json.load(f)
    
    def _update_approval_status(self, approval_id: str, status: ApprovalStatus):
        """Update approval status."""
        
        approval_data = self._load_approval(approval_id)
        if not approval_data:
            return
        
        approval_data["status"] = status.value
        approval_data["updated_at"] = datetime.now().isoformat()
        
        filepath = self.storage_dir / f"{approval_id}.json"
        with open(filepath, "w") as f:
            json.dump(approval_data, f, indent=2)
    
    async def _handle_callback(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle button callbacks."""
        
        query = update.callback_query
        await query.answer()
        
        # Parse callback data
        action, approval_id = query.data.split("_", 1)
        
        if action == "approve":
            self._update_approval_status(approval_id, ApprovalStatus.APPROVED)
            await query.edit_message_text(
                text=f"{query.message.text}\n\n✅ *APPROVED* by @{query.from_user.username}",
                parse_mode="Markdown"
            )
        
        elif action == "reject":
            self._update_approval_status(approval_id, ApprovalStatus.REJECTED)
            await query.edit_message_text(
                text=f"{query.message.text}\n\n❌ *REJECTED* by @{query.from_user.username}",
                parse_mode="Markdown"
            )
        
        elif action == "edit":
            # For now, just mark as approved with edit flag
            self._update_approval_status(approval_id, ApprovalStatus.EDITED)
            await query.message.reply_text(
                "✏️ Edit mode not fully implemented. Content marked for manual editing.",
                parse_mode="Markdown"
            )
        
        elif action == "view":
            # Load full content
            approval_data = self._load_approval(approval_id)
            if approval_data:
                full_content = approval_data["content"].get("content", "No content")
                await query.message.reply_text(
                    f"📋 *Full Content:*\n\n{full_content}",
                    parse_mode="Markdown"
                )
    
    async def _status_command(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle /status command."""
        
        pending_approvals = []
        for filepath in self.storage_dir.glob("*.json"):
            data = json.loads(filepath.read_text())
            if data["status"] == ApprovalStatus.PENDING.value:
                pending_approvals.append(data)
        
        if not pending_approvals:
            await update.message.reply_text("✅ No pending approvals")
        else:
            status_text = f"📋 *Pending Approvals ({len(pending_approvals)}):*\n\n"
            for approval in pending_approvals:
                status_text += f"• {approval['platform']} - {approval['brand']} (ID: {approval['id']})\n"
            
            await update.message.reply_text(status_text, parse_mode="Markdown")
    
    async def _start_polling(self):
        """Start bot polling in background."""
        
        if self.app and not self.app.running:
            try:
                await self.app.initialize()
                await self.app.start()
                await self.app.updater.start_polling(drop_pending_updates=True)
            except Exception as e:
                print(f"⚠️ Polling error: {e}")
    
    async def _terminal_approval(self, content: Dict[str, Any], platform: str) -> bool:
        """Fallback terminal approval."""
        
        print(f"\n{'='*60}")
        print(f"📱 {platform.upper()} POST APPROVAL REQUIRED")
        print(f"{'='*60}")
        print(f"\nContent:\n{content.get('content', 'No content')}")
        print(f"\nImage: {'Yes' if content.get('image_url') else 'No'}")
        print(f"{'='*60}")
        
        while True:
            response = input("\nApprove? (y/n): ").lower().strip()
            if response == 'y':
                return True
            elif response == 'n':
                return False
            else:
                print("Please enter 'y' for yes or 'n' for no")


# Convenience function for backwards compatibility
async def request_telegram_approval(
    content: Dict[str, Any], 
    platform: str,
    brand_config: Dict[str, Any]
) -> bool:
    """Request approval via Telegram."""
    workflow = TelegramApprovalWorkflow()
    return await workflow.request_approval(content, platform, brand_config)