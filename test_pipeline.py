#!/usr/bin/env python3
"""
Test script for Agent Social Pipeline
Simple testing interface for the consolidated pipeline.
"""

import asyncio
import argparse
import logging
from datetime import datetime
from pathlib import Path

# Import from consolidated pipeline
from social_pipeline import SocialPipeline

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

async def test_pipeline(topic: str = "caregiver burnout", auto_post: bool = False):
    """Test the main pipeline functionality."""
    logger.info(f"🧪 Testing pipeline with topic: {topic}")
    
    # Create pipeline with session management for testing
    from social_pipeline import SqliteWorkflowStorage
    pipeline = SocialPipeline(
        session_id=f"test-{topic.replace(' ', '-')}-{datetime.now().strftime('%Y%m%d-%H%M%S')}",
        storage=SqliteWorkflowStorage(
            table_name="test_social_pipeline_workflows",
            db_file="tmp/test_social_pipeline.db"
        )
    )
    
    print(f"🚀 Starting pipeline for: {topic}")
    print("=" * 50)
    
    async for response in pipeline.run(
        topic=topic,
        platforms=["twitter", "linkedin"],
        auto_post=auto_post
    ):
        content = response.content
        
        if isinstance(content, dict):
            step = content.get("step", "unknown")
            message = content.get("message", "Processing...")
            
            print(f"📝 {step}: {message}")
            
            # Show approval ID if available
            if step == "approval_sent":
                approval_id = content.get("approval_id")
                print(f"   📋 Approval ID: {approval_id}")
            
            # Break on final status
            if content.get("status") in ["success", "rejected", "timeout", "error"]:
                status = content.get("status")
                final_message = content.get("message", "Pipeline completed")
                
                print("=" * 50)
                print(f"✅ Final Status: {status.upper()}")
                print(f"💬 {final_message}")
                
                # Show posting results if available
                posting_results = content.get("posting_results", [])
                if posting_results:
                    print("\n📱 Posting Results:")
                    for result in posting_results:
                        status_icon = "✅" if result["status"] == "success" else "❌"
                        print(f"   {status_icon} {result['platform']}: {result['status']}")
                        if result.get("post_id"):
                            print(f"      Post ID: {result['post_id']}")
                        if result.get("error"):
                            print(f"      Error: {result['error']}")
                
                break

async def test_brand_config():
    """Test brand configuration loading."""
    logger.info("🧪 Testing brand configuration...")
    
    brand_path = Path("brand/givecare.yml")
    if not brand_path.exists():
        print("❌ Brand config not found at brand/givecare.yml")
        return
    
    pipeline = SocialPipeline(brand_config_path=str(brand_path))
    
    print("✅ Brand configuration loaded successfully!")
    print(f"   Brand: {pipeline.brand_cfg.get('name', 'Unknown')}")
    print(f"   Voice: {pipeline.brand_cfg.get('voice_tone', 'Not specified')}")
    print(f"   Approval required: {pipeline.brand_cfg.get('approval', {}).get('required', False)}")

async def test_approval_workflow():
    """Test the approval workflow components."""
    logger.info("🧪 Testing approval workflow...")
    
    from social_pipeline import ApprovalState
    
    # Test approval state management
    approval_state = ApprovalState("test_approval_state.json")
    
    # Test adding approval
    test_data = {
        "story": {"title": "Test Story"},
        "post": {"text": "Test post"},
        "media": None
    }
    
    approval_state.add_pending_approval("test-123", test_data)
    
    # Test retrieving approval
    retrieved = approval_state.get_pending_approval("test-123")
    assert retrieved is not None, "Failed to retrieve approval"
    assert retrieved["status"] == "pending", "Incorrect initial status"
    
    # Test updating status
    approval_state.update_approval_status("test-123", "approved", "user123")
    updated = approval_state.get_pending_approval("test-123")
    assert updated["status"] == "approved", "Failed to update status"
    
    print("✅ Approval state management working correctly!")
    
    # Clean up test file
    Path("test_approval_state.json").unlink(missing_ok=True)

def main():
    """Main test runner."""
    parser = argparse.ArgumentParser(description="Test Agent Social Pipeline")
    parser.add_argument("--topic", default="caregiver burnout", help="Topic to test with")
    parser.add_argument("--auto-post", action="store_true", help="Skip approval workflow")
    parser.add_argument("--test-brand", action="store_true", help="Test brand configuration")
    parser.add_argument("--test-approval", action="store_true", help="Test approval workflow")
    
    args = parser.parse_args()
    
    async def run_tests():
        try:
            if args.test_brand:
                await test_brand_config()
            elif args.test_approval:
                await test_approval_workflow()
            else:
                await test_pipeline(args.topic, args.auto_post)
                
        except Exception as e:
            logger.error(f"❌ Test failed: {e}")
            raise
    
    print("🧪 Agent Social Pipeline Test Suite")
    print("=" * 40)
    
    asyncio.run(run_tests())

if __name__ == "__main__":
    main() 