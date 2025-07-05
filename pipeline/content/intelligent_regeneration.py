"""
Intelligent Content Regeneration with Evaluation Feedback Loop
Uses Agno agents with evaluation feedback for iterative improvement
"""

import asyncio
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime
from agno.agent import Agent
from agno.models.azure import AzureOpenAI
from pydantic import BaseModel, Field
import os
import yaml

from .content_generation import create_content_agent, ContentGenerationResult
from ..evaluation import SocialContentJudge


class ContentImprovementSuggestion(BaseModel):
    """Structured suggestions for content improvement."""
    issue_identified: str = Field(description="What specific issue was found")
    improvement_suggestion: str = Field(description="Specific suggestion to fix the issue")
    focus_area: str = Field(description="Which area to focus on: brand_voice, engagement, platform_optimization, or quality")


class ContentRegenerationResult(BaseModel):
    """Result of content regeneration with evaluation feedback."""
    improved_content: str = Field(description="The improved content")
    improvement_explanation: str = Field(description="What was changed and why")
    previous_issues: List[str] = Field(description="Issues that were addressed")
    confidence_score: float = Field(description="Confidence in improvement (0-1)")


class IntelligentContentRegenerator:
    """
    Intelligent content regeneration using evaluation feedback and Agno agents.
    Implements a feedback loop for continuous improvement.
    """
    
    def __init__(self, brand_config: Dict[str, Any], model: str = "gpt-4.5-preview"):
        self.brand_config = brand_config
        self.model = model
        self.brand_name = brand_config.get("name", "Brand")
        
        # Initialize evaluation judge
        self.judge = SocialContentJudge(brand_config, "gpt-4o-mini")
        
        # Create improvement agent
        self.improvement_agent = self._create_improvement_agent()
        
        # Quality thresholds
        self.minimum_score = 0.6  # Below this = automatic regeneration
        self.target_score = 0.8   # Above this = acceptable
        self.max_iterations = 3   # Prevent infinite loops
    
    def _create_improvement_agent(self) -> Agent:
        """Create Agno agent specialized in content improvement."""
        brand_voice = self.brand_config.get("voice", {})
        topics = self.brand_config.get("topics", [])
        
        instructions = [
            f"You are a content improvement specialist for {self.brand_name}.",
            f"Brand voice: {brand_voice.get('tone', 'professional')} and {brand_voice.get('style', 'engaging')}",
            f"Brand topics: {', '.join(topics)}",
            "",
            "Your job is to improve social media content based on evaluation feedback.",
            "Focus on:",
            "1. Brand voice alignment and authenticity",
            "2. Engagement potential and emotional connection", 
            "3. Platform-specific optimization",
            "4. Content quality and clarity",
            "",
            "Always maintain the core message while improving weaknesses.",
            "Make specific, actionable improvements based on the feedback provided."
        ]
        
        model = AzureOpenAI(
            azure_deployment=os.getenv("AZURE_OPENAI_DEFAULT_MODEL", "gpt-4.5-preview"),
            api_key=os.getenv("AZURE_OPENAI_API_KEY"),
            azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT"),
            api_version=os.getenv("AZURE_OPENAI_API_VERSION", "2025-01-01-preview"),
        )
        
        return Agent(
            name=f"{self.brand_name}_content_improver",
            model=model,
            instructions=instructions,
            response_model=ContentRegenerationResult
        )
    
    async def evaluate_and_improve_if_needed(
        self, 
        content: str, 
        platform: str,
        context: Optional[str] = None,
        min_score_override: Optional[float] = None
    ) -> Tuple[str, Dict[str, Any], bool]:
        """
        Evaluate content and improve it if below threshold.
        
        Returns:
            (final_content, evaluation_result, was_improved)
        """
        min_score = min_score_override or self.minimum_score
        
        # Initial evaluation
        evaluation = await self.judge.evaluate_content_quality(content, platform, context)
        
        if evaluation["overall_score"] >= min_score:
            print(f"✅ Content passed evaluation: {evaluation['overall_score']:.2f}")
            return content, evaluation, False
        
        print(f"⚠️ Content below threshold ({evaluation['overall_score']:.2f} < {min_score})")
        print("🔄 Starting intelligent regeneration...")
        
        # Improve content iteratively
        improved_content, final_evaluation = await self._improve_content_iteratively(
            content, platform, context, evaluation
        )
        
        return improved_content, final_evaluation, True
    
    async def _improve_content_iteratively(
        self,
        original_content: str,
        platform: str, 
        context: Optional[str],
        initial_evaluation: Dict[str, Any]
    ) -> Tuple[str, Dict[str, Any]]:
        """Iteratively improve content until it meets quality standards."""
        
        current_content = original_content
        current_evaluation = initial_evaluation
        iteration = 0
        
        improvement_history = []
        
        while (current_evaluation["overall_score"] < self.target_score and 
               iteration < self.max_iterations):
            
            iteration += 1
            print(f"🔄 Improvement iteration {iteration}/{self.max_iterations}")
            
            # Generate improvement suggestions based on evaluation
            improvement_prompt = self._build_improvement_prompt(
                current_content, platform, current_evaluation, context
            )
            
            try:
                # Use Agno agent to improve content
                response = await self.improvement_agent.arun(improvement_prompt)
                result = response.content if hasattr(response, 'content') else response
                
                # Update content
                current_content = result.improved_content
                
                # Re-evaluate improved content
                new_evaluation = await self.judge.evaluate_content_quality(
                    current_content, platform, context
                )
                
                improvement_info = {
                    "iteration": iteration,
                    "previous_score": current_evaluation["overall_score"],
                    "new_score": new_evaluation["overall_score"],
                    "improvement": result.improvement_explanation,
                    "issues_addressed": result.previous_issues
                }
                improvement_history.append(improvement_info)
                
                print(f"  📊 Score: {current_evaluation['overall_score']:.2f} → {new_evaluation['overall_score']:.2f}")
                print(f"  🔧 {result.improvement_explanation}")
                
                current_evaluation = new_evaluation
                
                # Stop if we've reached target or improvement plateaued
                if (new_evaluation["overall_score"] >= self.target_score or
                    new_evaluation["overall_score"] <= current_evaluation["overall_score"] + 0.05):
                    break
                    
            except Exception as e:
                print(f"❌ Improvement iteration {iteration} failed: {e}")
                break
        
        # Add improvement history to final evaluation
        current_evaluation["improvement_history"] = improvement_history
        current_evaluation["total_iterations"] = iteration
        current_evaluation["original_score"] = initial_evaluation["overall_score"]
        
        final_score = current_evaluation["overall_score"]
        if final_score >= self.target_score:
            print(f"✅ Content improved to acceptable quality: {final_score:.2f}")
        elif final_score > initial_evaluation["overall_score"]:
            print(f"⚠️ Content partially improved: {initial_evaluation['overall_score']:.2f} → {final_score:.2f}")
        else:
            print(f"❌ Content improvement failed, keeping original")
            current_content = original_content
            current_evaluation = initial_evaluation
        
        return current_content, current_evaluation
    
    def _build_improvement_prompt(
        self,
        content: str,
        platform: str,
        evaluation: Dict[str, Any],
        context: Optional[str]
    ) -> str:
        """Build improvement prompt based on evaluation feedback."""
        
        score = evaluation["overall_score"]
        explanation = evaluation.get("explanation", "No detailed feedback available")
        
        prompt_parts = [
            f"Improve this {platform} content for {self.brand_name}:",
            f"",
            f"Current content: \"{content}\"",
            f"",
            f"Current evaluation score: {score:.2f}/1.0",
            f"Evaluation feedback: {explanation}",
            f"",
            f"Platform: {platform}",
        ]
        
        if context:
            prompt_parts.extend([
                f"Context: {context}",
                f""
            ])
        
        # Identify likely issues based on score ranges
        if score < 0.4:
            issues = "Major issues with brand alignment, engagement, and platform optimization"
        elif score < 0.6:
            issues = "Moderate issues with brand voice or platform optimization"  
        elif score < 0.8:
            issues = "Minor improvements needed for engagement or clarity"
        else:
            issues = "Fine-tuning for optimal performance"
        
        prompt_parts.extend([
            f"Likely issues: {issues}",
            f"",
            f"Requirements:",
            f"- Maintain core message and intent",
            f"- Improve brand voice alignment with {self.brand_name}",
            f"- Enhance engagement potential", 
            f"- Optimize for {platform} best practices",
            f"- Keep within platform constraints",
            f"",
            f"Provide improved content with explanation of changes made."
        ])
        
        return "\n".join(prompt_parts)
    
    async def get_human_feedback_and_improve(
        self,
        content: str,
        platform: str,
        evaluation: Dict[str, Any],
        human_feedback: str
    ) -> Tuple[str, Dict[str, Any]]:
        """Improve content based on human feedback."""
        
        feedback_prompt = f"""
Improve this {platform} content for {self.brand_name} based on human feedback:

Current content: "{content}"
Platform: {platform}
Current score: {evaluation["overall_score"]:.2f}/1.0

Human feedback: "{human_feedback}"

Create improved content that addresses the human feedback while maintaining brand alignment.
Explain what specific changes you made and why.
"""
        
        try:
            response = await self.improvement_agent.arun(feedback_prompt)
            result = response.content if hasattr(response, 'content') else response
            
            # Re-evaluate the human-feedback improved content
            new_evaluation = await self.judge.evaluate_content_quality(
                result.improved_content, platform
            )
            
            new_evaluation["human_feedback_applied"] = human_feedback
            new_evaluation["improvement_explanation"] = result.improvement_explanation
            
            print(f"🔄 Applied human feedback")
            print(f"📊 Score: {evaluation['overall_score']:.2f} → {new_evaluation['overall_score']:.2f}")
            print(f"🔧 {result.improvement_explanation}")
            
            return result.improved_content, new_evaluation
            
        except Exception as e:
            print(f"❌ Failed to apply human feedback: {e}")
            return content, evaluation


# Helper functions for integration with existing pipeline
async def evaluate_and_improve_content_dict(
    content_dict: Dict[str, str],
    brand_config: Dict[str, Any],
    context: Optional[str] = None,
    min_score: float = 0.6
) -> Tuple[Dict[str, str], Dict[str, Dict[str, Any]], bool]:
    """
    Evaluate and improve a dictionary of platform content.
    
    Returns:
        (improved_content_dict, evaluation_results, any_improved)
    """
    regenerator = IntelligentContentRegenerator(brand_config)
    
    improved_content = {}
    evaluation_results = {}
    any_improved = False
    
    for platform, content in content_dict.items():
        improved, evaluation, was_improved = await regenerator.evaluate_and_improve_if_needed(
            content, platform, context, min_score
        )
        
        improved_content[platform] = improved
        evaluation_results[platform] = evaluation
        if was_improved:
            any_improved = True
    
    return improved_content, evaluation_results, any_improved


def should_request_human_feedback(evaluation_results: Dict[str, Dict[str, Any]]) -> bool:
    """Determine if human feedback is needed based on evaluation results."""
    poor_scores = [
        result["overall_score"] for result in evaluation_results.values() 
        if result["overall_score"] < 0.7
    ]
    return len(poor_scores) > 0