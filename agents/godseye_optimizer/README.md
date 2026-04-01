# God's Eye Optimizer Agent

A specialized AI subagent designed to analyze and optimize the God's Eye flight tracking application for improved performance, graphics quality, and functionality.

## Features

- **Performance Analysis**: Identifies bottlenecks in React components, Three.js rendering, and API calls
- **Graphics Optimization**: Suggests improvements for globe visualization, animations, and frame rates
- **Bug Detection**: Finds crashes, memory leaks, and broken functionality
- **UI/UX Improvements**: Recommends enhancements for responsiveness and user experience
- **Code Analysis**: Reviews codebase for maintainability and optimization opportunities

## Quick Start

1. **Install dependencies**:
   ```bash
   cd agents/godseye_optimizer
   pip install -r requirements.txt
   ```

2. **Configure environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your OpenAI API key
   ```

3. **Run analysis**:
   ```bash
   python cli.py
   ```

## Usage

### Full Analysis
Run a comprehensive analysis of the entire application:
```bash
python cli.py --depth comprehensive
```

### Targeted Optimization
Focus on specific components or issues:
```bash
# Analyze frontend performance
python cli.py --component frontend --issue-type performance

# Optimize graphics rendering
python cli.py --component frontend --issue-type graphics

# Detect crashes and bugs
python cli.py --issue-type crashes
```

### Save Report
Save analysis results to a file:
```bash
python cli.py --output optimization_report.md
```

## Analysis Areas

### Performance
- React component re-rendering optimization
- Three.js/WebGL rendering performance
- Memory usage and leak detection
- API response time optimization
- Database query performance

### Graphics
- Globe rendering optimization
- Animation smoothness improvements
- Texture loading and management
- Frame rate optimization
- Visual quality enhancements

### Functionality
- Crash detection and prevention
- Error handling improvements
- Data flow validation
- State management optimization
- Feature completeness verification

### UI/UX
- Responsive design improvements
- Touch interaction optimization
- Accessibility enhancements
- Visual design refinements
- User experience patterns

## Output Format

The agent generates detailed reports with:
- **Issue Identification**: Clear description of problems found
- **Impact Assessment**: Why the issue matters
- **Solution Recommendations**: Specific implementation approaches
- **Code Examples**: Concrete code changes with before/after
- **Validation Steps**: How to test improvements
- **Priority Ranking**: High-impact changes first

## Integration

This agent follows the Pydantic AI agent factory pattern and can be integrated into your existing workflow:

```python
from agents.godseye_optimizer import run_full_analysis

# Run analysis
results = await run_full_analysis()
report = generate_optimization_report(results)
```

## Requirements

- Python 3.8+
- OpenAI API key
- Access to God's Eye codebase
- Pydantic AI library

## Development

The agent is built using:
- **Pydantic AI**: For agent framework and LLM integration
- **AST Analysis**: For static code analysis
- **Performance Profiling**: For runtime metrics collection
- **Pattern Recognition**: For identifying optimization opportunities

## Contributing

When adding new optimization tools:
1. Add the tool function to `tools.py`
2. Register it with the agent in `agent.py`
3. Update the CLI interface in `cli.py`
4. Add tests and documentation