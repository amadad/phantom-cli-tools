"""
Enhanced Approval Workflow with Feedback Loop
Allows humans to provide feedback for content improvement, not just approve/reject
"""

import asyncio
from typing import Dict, Any, Optional, Tuple
from datetime import datetime


class EnhancedApprovalWorkflow:
    """
    Enhanced approval workflow that supports:
    1. Approve/Reject (existing)
    2. Feedback for improvement (new)
    3. Multiple improvement iterations (new)
    """
    
    def __init__(self):
        self.max_feedback_iterations = 2
    
    async def request_approval_with_feedback(
        self,
        content: Dict[str, str],
        evaluation_results: Dict[str, Dict[str, Any]],
        brand_config: Dict[str, Any],
        image_url: Optional[str] = None
    ) -> Tuple[bool, Optional[str], Dict[str, Any]]:
        """
        Request approval with option for improvement feedback.
        
        Returns:
            (approved, feedback, approval_metadata)
        """
        
        # Display content and evaluation scores
        self._display_content_for_approval(content, evaluation_results, image_url)
        
        while True:
            print("\n" + "="*60)
            print("📝 APPROVAL OPTIONS:")
            print("  [y] Approve and post")
            print("  [n] Reject completely") 
            print("  [f] Provide feedback for improvement")
            print("  [s] Show evaluation details")
            print("="*60)
            
            try:
                choice = input("Your choice (y/n/f/s): ").lower().strip()
                
                if choice == 'y':
                    print("✅ Content APPROVED for posting")
                    return True, None, {"action": "approved", "timestamp": datetime.now().isoformat()}
                
                elif choice == 'n':
                    reason = input("💭 Rejection reason (optional): ").strip()
                    print("❌ Content REJECTED")
                    return False, None, {
                        "action": "rejected", 
                        "reason": reason,
                        "timestamp": datetime.now().isoformat()
                    }
                
                elif choice == 'f':
                    feedback = input("💬 What should be improved? ").strip()
                    if feedback:
                        print("🔄 Feedback provided for improvement")
                        return False, feedback, {
                            "action": "feedback_provided",
                            "feedback": feedback,
                            "timestamp": datetime.now().isoformat()
                        }
                    else:
                        print("⚠️ No feedback provided, please try again")
                
                elif choice == 's':
                    self._show_detailed_evaluation(evaluation_results)
                
                else:
                    print("⚠️ Invalid choice. Please use y, n, f, or s")
                    
            except (EOFError, KeyboardInterrupt):
                print("\n❌ Approval cancelled")
                return False, None, {"action": "cancelled", "timestamp": datetime.now().isoformat()}
    
    def _display_content_for_approval(
        self,
        content: Dict[str, str],
        evaluation_results: Dict[str, Dict[str, Any]],
        image_url: Optional[str] = None
    ):
        """Display content and scores for human review."""
        
        print("\n" + "="*60)
        print("📱 CONTENT APPROVAL REQUIRED")
        print("="*60)
        
        for platform, text in content.items():
            evaluation = evaluation_results.get(platform, {})
            score = evaluation.get("overall_score", 0.0)
            
            # Color coding for scores
            if score >= 0.8:
                score_indicator = "🟢 GOOD"
            elif score >= 0.6:
                score_indicator = "🟡 OK"
            else:
                score_indicator = "🔴 POOR"
            
            print(f"\n📱 {platform.upper()} POST:")
            print("-" * 40)
            print(f"Content: {text}")
            print(f"Score: {score:.2f}/1.0 {score_indicator}")
            
            if evaluation.get("explanation"):
                print(f"AI Feedback: {evaluation['explanation']}")
            
            # Show improvement history if available
            if evaluation.get("improvement_history"):
                print(f"🔄 Improved from {evaluation.get('original_score', 0):.2f}")
        
        if image_url:
            print(f"\n🖼️ Image: {image_url}")
        
        print("-" * 60)
    
    def _show_detailed_evaluation(self, evaluation_results: Dict[str, Dict[str, Any]]):
        """Show detailed evaluation breakdown."""
        
        print("\n" + "="*50)
        print("📊 DETAILED EVALUATION")
        print("="*50)
        
        for platform, evaluation in evaluation_results.items():
            print(f"\n🔍 {platform.upper()} ANALYSIS:")
            print("-" * 30)
            print(f"Overall Score: {evaluation.get('overall_score', 0):.2f}/1.0")
            print(f"Evaluation Method: {evaluation.get('model_used', 'unknown')}")
            print(f"Content Length: {evaluation.get('content_length', 0)} chars")
            
            if evaluation.get("explanation"):
                print(f"AI Analysis: {evaluation['explanation']}")
            
            if evaluation.get("improvement_history"):
                print("\n🔄 Improvement History:")
                for i, improvement in enumerate(evaluation["improvement_history"], 1):
                    print(f"  {i}. {improvement['previous_score']:.2f} → {improvement['new_score']:.2f}")
                    print(f"     {improvement['improvement']}")
            
            if evaluation.get("evaluation_type"):
                eval_type = evaluation["evaluation_type"]
                if eval_type == "multimodal":
                    print("📸 Multimodal: Evaluated text + image together")
                elif eval_type == "image":
                    print("🖼️ Image-only evaluation")
                else:
                    print("📝 Text-only evaluation")


class SmartApprovalDecision:
    """
    Smart approval decision logic based on evaluation scores.
    """
    
    @staticmethod
    def should_auto_approve(evaluation_results: Dict[str, Dict[str, Any]]) -> bool:
        """Determine if content should be auto-approved based on scores."""
        all_scores = [result.get("overall_score", 0) for result in evaluation_results.values()]
        
        # Auto-approve if ALL content scores 0.85 or higher
        return all(score >= 0.85 for score in all_scores)
    
    @staticmethod
    def should_auto_reject(evaluation_results: Dict[str, Dict[str, Any]]) -> bool:
        """Determine if content should be auto-rejected based on scores."""
        all_scores = [result.get("overall_score", 0) for result in evaluation_results.values()]
        
        # Auto-reject if ANY content scores below 0.3
        return any(score < 0.3 for score in all_scores)
    
    @staticmethod
    def requires_human_review(evaluation_results: Dict[str, Dict[str, Any]]) -> bool:
        """Determine if human review is required."""
        all_scores = [result.get("overall_score", 0) for result in evaluation_results.values()]
        
        # Human review needed if any score is between 0.3 and 0.85
        return any(0.3 <= score < 0.85 for score in all_scores)
    
    @staticmethod
    def get_approval_recommendation(evaluation_results: Dict[str, Dict[str, Any]]) -> str:
        """Get approval recommendation based on scores."""
        all_scores = [result.get("overall_score", 0) for result in evaluation_results.values()]
        avg_score = sum(all_scores) / len(all_scores) if all_scores else 0
        
        if avg_score >= 0.85:
            return "🟢 RECOMMEND APPROVAL - High quality content"
        elif avg_score >= 0.7:
            return "🟡 REVIEW RECOMMENDED - Good content with minor issues"
        elif avg_score >= 0.5:
            return "🟠 IMPROVEMENT SUGGESTED - Moderate issues identified"
        else:
            return "🔴 REJECT RECOMMENDED - Significant quality issues"


# Terminal approval fallback (existing functionality)
async def terminal_approval_fallback(
    content: Dict[str, str],
    evaluation_results: Dict[str, Dict[str, Any]] = None,
    image_url: Optional[str] = None
) -> bool:
    """
    Simple terminal approval for when enhanced approval is not available.
    """
    print("\n" + "="*60)
    print("📱 TERMINAL APPROVAL REQUIRED")
    print("="*60)
    
    for platform, text in content.items():
        score = ""
        if evaluation_results and platform in evaluation_results:
            score_val = evaluation_results[platform].get("overall_score", 0)
            score = f" (Score: {score_val:.2f})"
        
        print(f"\n{platform.upper()}{score}:")
        print(text)
    
    if image_url:
        print(f"\nImage: {image_url}")
    
    print("="*60)
    
    try:
        response = input("Approve? (y/n): ").lower().strip()
        return response in ['y', 'yes', '1', 'true']
    except (EOFError, KeyboardInterrupt):
        print("\n❌ Approval cancelled")
        return False