"""
Evaluation functions for social media content quality assessment.
"""
import re
from typing import Dict, Any, List


def evaluate_content_quality(content: str, platform: str, brand_config: Dict[str, Any]) -> Dict[str, Any]:
    """
    Automated content evaluation with scoring.
    Returns detailed score breakdown.
    """
    scores = {}
    
    # 1. Format checks
    platform_config = brand_config.get("platforms", {}).get(platform, {})
    max_chars = platform_config.get("max_chars", 280)
    
    scores["length_valid"] = 1.0 if len(content) <= max_chars else 0.0
    scores["length_optimal"] = 1.0 if len(content) >= max_chars * 0.7 else 0.5
    
    # 2. Brand voice alignment
    brand_attributes = brand_config.get("voice", {}).get("attributes", [])
    tone_words = ["empathetic", "supportive", "helpful", "encouraging", "practical"]
    
    content_lower = content.lower()
    tone_matches = sum(1 for word in tone_words if word in content_lower)
    scores["tone_alignment"] = min(tone_matches / 2, 1.0)  # Cap at 1.0
    
    # 3. Hashtag presence and count
    hashtags = re.findall(r'#\w+', content)
    hashtag_limit = platform_config.get("hashtag_limit", 3)
    
    scores["has_hashtags"] = 1.0 if hashtags else 0.0
    scores["hashtag_count_good"] = 1.0 if len(hashtags) <= hashtag_limit else 0.5
    
    # 4. Caregiver-specific keywords
    caregiver_keywords = ["caregiver", "caregiving", "support", "community", "care", "family"]
    keyword_matches = sum(1 for word in caregiver_keywords if word in content_lower)
    scores["caregiver_relevance"] = min(keyword_matches / 2, 1.0)
    
    # 5. Engagement elements
    engagement_patterns = [r'[!?]', r'💛|💚|❤️|💙', r'\b(you|your)\b', r'\b(share|comment|join)\b']
    engagement_score = sum(1 for pattern in engagement_patterns if re.search(pattern, content, re.IGNORECASE))
    scores["engagement_elements"] = min(engagement_score / 2, 1.0)
    
    # Calculate overall score
    overall_score = sum(scores.values()) / len(scores)
    
    return {
        "overall_score": round(overall_score, 2),
        "breakdown": scores,
        "content_length": len(content),
        "hashtag_count": len(hashtags),
        "evaluation_criteria": "Format, tone, hashtags, relevance, engagement"
    }


def evaluate_pipeline_run(content_results: Dict[str, str], brand_config: Dict[str, Any], 
                         image_url: str = None, visual_prompt: str = None) -> Dict[str, Any]:
    """
    Evaluate complete pipeline run across all platforms.
    """
    platform_scores = {}
    
    for platform, content in content_results.items():
        platform_scores[platform] = evaluate_content_quality(content, platform, brand_config)
    
    # Overall pipeline metrics
    overall_scores = [score["overall_score"] for score in platform_scores.values()]
    avg_score = sum(overall_scores) / len(overall_scores) if overall_scores else 0
    
    # Image generation success
    image_success = 1.0 if image_url else 0.0
    
    # Visual prompt quality (basic check)
    visual_quality = 0.0
    if visual_prompt:
        if len(visual_prompt) > 50 and any(word in visual_prompt.lower() 
                                          for word in ["caregiver", "family", "home", "caring"]):
            visual_quality = 1.0
        elif len(visual_prompt) > 20:
            visual_quality = 0.5
    
    return {
        "pipeline_score": round(avg_score, 2),
        "platform_scores": platform_scores,
        "image_generation_success": image_success,
        "visual_prompt_quality": visual_quality,
        "total_platforms": len(content_results),
        "successful_platforms": sum(1 for score in platform_scores.values() if score["overall_score"] > 0.6)
    }


def run_test_scenarios(test_scenarios: List[Dict[str, Any]]) -> List[str]:
    """
    Extract topics from test scenarios for pipeline testing.
    """
    return [scenario["topic"] for scenario in test_scenarios]


def grade_pipeline_performance(pipeline_results: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Grade overall pipeline performance across multiple test runs.
    """
    if not pipeline_results:
        return {"grade": "F", "score": 0.0, "feedback": "No results to evaluate"}
    
    avg_score = sum(result.get("pipeline_score", 0) for result in pipeline_results) / len(pipeline_results)
    
    # Grading scale
    if avg_score >= 0.9:
        grade = "A"
        feedback = "Excellent content generation across all metrics"
    elif avg_score >= 0.8:
        grade = "B"  
        feedback = "Good content quality with minor improvements needed"
    elif avg_score >= 0.7:
        grade = "C"
        feedback = "Acceptable content but significant room for improvement"
    elif avg_score >= 0.6:
        grade = "D"
        feedback = "Below expectations, major issues with content quality"
    else:
        grade = "F"
        feedback = "Poor content generation, requires significant fixes"
    
    return {
        "grade": grade,
        "average_score": round(avg_score, 2),
        "total_runs": len(pipeline_results),
        "feedback": feedback,
        "detailed_results": pipeline_results
    }


def evaluate_content(content: str, brand_config: Dict[str, Any]) -> float:
    """
    Simple content evaluation function that returns a score between 0 and 1.
    This is a compatibility wrapper for the main application.
    """
    # Use the first platform in the brand config or default to 'twitter'
    platforms = brand_config.get("platforms", {})
    platform = list(platforms.keys())[0] if platforms else "twitter"
    
    evaluation = evaluate_content_quality(content, platform, brand_config)
    return evaluation["overall_score"]