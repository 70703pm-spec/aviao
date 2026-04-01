"""God's Eye Optimizer Agent Package."""

from .agent import optimizer_agent, run_full_analysis, optimize_component, generate_optimization_report
from .dependencies import OptimizerDependencies, create_optimizer_dependencies
from .settings import settings
from .providers import get_llm_model, get_model_info, validate_llm_configuration

__version__ = "1.0.0"

__all__ = [
    "optimizer_agent",
    "run_full_analysis",
    "optimize_component",
    "generate_optimization_report",
    "OptimizerDependencies",
    "create_optimizer_dependencies",
    "settings",
    "get_llm_model",
    "get_model_info",
    "validate_llm_configuration",
]