"""LLM service for Vertex AI Gemini integration."""
import os
import json
from pathlib import Path
from typing import Dict, Any, Optional
from vertexai.generative_models import GenerativeModel
from google.cloud import aiplatform
from app.config.settings import settings


class LLMService:
    """Service for interacting with Vertex AI Gemini LLM."""
    
    def __init__(self):
        # Set up credentials path (relative to backend directory or absolute)
        creds_path = settings.GOOGLE_APPLICATION_CREDENTIALS
        if not Path(creds_path).is_absolute():
            # If relative, assume it's in the backend directory
            backend_dir = Path(__file__).parent.parent.parent
            creds_path = str(backend_dir / creds_path)
        
        os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = creds_path
        os.environ['GOOGLE_CLOUD_PROJECT'] = settings.GOOGLE_CLOUD_PROJECT
        
        # Initialize Vertex AI
        aiplatform.init(
            project=settings.GOOGLE_CLOUD_PROJECT,
            location=settings.VERTEX_AI_LOCATION
        )
        
        # Use model from settings (default: gemini-2.5-pro)
        model_name = settings.GEMINI_MODEL_NAME
        self.model = GenerativeModel(model_name)
    
    def generate(self, prompt: str, system_prompt: Optional[str] = None) -> str:
        """Generate response from LLM."""
        try:
            full_prompt = prompt
            if system_prompt:
                full_prompt = f"{system_prompt}\n\n{prompt}"
            
            response = self.model.generate_content(full_prompt)
            
            # Vertex AI GenerativeModel - access text directly
            # The response object should have a .text property
            try:
                return response.text
            except AttributeError:
                # Fallback: try accessing through candidates
                if hasattr(response, 'candidates') and response.candidates:
                    candidate = response.candidates[0]
                    if hasattr(candidate, 'content') and candidate.content:
                        if hasattr(candidate.content, 'parts') and candidate.content.parts:
                            # Extract text from parts
                            text_parts = []
                            for part in candidate.content.parts:
                                if hasattr(part, 'text') and part.text:
                                    text_parts.append(part.text)
                            if text_parts:
                                return ''.join(text_parts)
                
                # Last resort: try string conversion
                result_str = str(response)
                if result_str and result_str != "None" and result_str.startswith("candidates"):
                    # If it's showing candidates structure, extract manually
                    import json
                    if hasattr(response, '__dict__'):
                        response_dict = response.__dict__
                        if 'candidates' in response_dict:
                            candidates = response_dict['candidates']
                            if candidates and len(candidates) > 0:
                                candidate = candidates[0]
                                if hasattr(candidate, 'content'):
                                    content = candidate.content
                                    if hasattr(content, 'parts'):
                                        parts = content.parts
                                        if parts:
                                            for part in parts:
                                                if hasattr(part, 'text'):
                                                    return part.text
                
                raise Exception(f"No text content found in LLM response. Response type: {type(response)}, Response: {str(response)[:200]}")
        except Exception as e:
            error_msg = f"LLM generation failed: {str(e)}"
            print(f"LLM Error: {error_msg}")
            print(f"Error type: {type(e).__name__}")
            import traceback
            traceback.print_exc()
            raise Exception(error_msg)
    
    def generate_json(self, prompt: str, system_prompt: Optional[str] = None) -> Dict[str, Any]:
        """Generate JSON response from LLM."""
        json_prompt = f"{prompt}\n\nReturn only valid JSON, no markdown formatting."
        response_text = self.generate(json_prompt, system_prompt)
        
        # Try to extract JSON from response
        import json
        import re
        
        # Clean up the response text
        response_text = response_text.strip()
        
        # Remove markdown code blocks if present
        # Handle ```json ... ``` format
        json_match = re.search(r'```(?:json)?\s*([\[\{].*?[\]\}])\s*```', response_text, re.DOTALL)
        if json_match:
            response_text = json_match.group(1)
        else:
            # Try to find JSON array first (for scenarios)
            array_match = re.search(r'\[.*\]', response_text, re.DOTALL)
            if array_match:
                response_text = array_match.group(0)
            else:
                # Try to find JSON object
                json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
                if json_match:
                    response_text = json_match.group(0)
        
        try:
            result = json.loads(response_text)
            return result
        except json.JSONDecodeError as e:
            print(f"JSON decode error: {e}")
            print(f"Response text: {response_text[:500]}")
            # Fallback: return as text wrapped in dict
            return {"content": response_text}
