"""Model providers for the God's Eye Optimizer Agent."""

from typing import Optional
from pydantic_ai.providers.openai import OpenAIProvider
from pydantic_ai.models.openai import OpenAIModel
from .settings import settings


def get_llm_model(model_choice: Optional[str] = None) -> OpenAIModel:
    """
    Get configured LLM model for the optimizer agent.
    
    Args:
        model_choice: Optional override for model choice
    
    Returns:
        Configured OpenAI-compatible model
    """
    llm_choice = model_choice or settings.llm_model
    base_url = settings.llm_base_url
    api_key = settings.llm_api_key or "ollama"  # Default for Ollama
    
    # Create provider - for Ollama, use localhost
    if "ollama" in base_url.lower() or not api_key or api_key == "ollama":
        base_url = "http://localhost:11434/v1"  # Ollama default
        api_key = "ollama"  # Ollama doesn't need real API key
    
    provider = OpenAIProvider(base_url=base_url, api_key=api_key)
    
    return OpenAIModel(llm_choice, provider=provider)


def get_ollama_model(model_name: str = "qwen3") -> OpenAIModel:
    """
    Get Ollama model specifically.
    
    Args:
        model_name: Ollama model name (default: qwen3)
    
    Returns:
        Configured Ollama model
    """
    provider = OpenAIProvider(
        base_url="http://localhost:11434/v1",
        api_key="ollama"
    )
    return OpenAIModel(model_name, provider=provider)


def get_model_info() -> dict:
    """
    Get information about current model configuration.
    
    Returns:
        Dictionary with model configuration info
    """
    return {
        "llm_provider": settings.llm_provider,
        "llm_model": settings.llm_model,
        "llm_base_url": settings.llm_base_url,
        "analysis_depth": settings.analysis_depth,
        "target_components": settings.target_components,
    }


def validate_llm_configuration() -> bool:
    """
    Validate that LLM configuration is properly set.
    
    Returns:
        True if configuration is valid
    """
    try:
        # Try to create a model instance
        get_llm_model()
        return True
    except Exception as e:
        print(f"LLM configuration validation failed: {e}")
        return False