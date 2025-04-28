import requests
import json
from typing import Dict, Any, Optional, Generator, List, ClassVar
import os
from flask import Flask, render_template, request, jsonify, session, Response, stream_with_context
from flask_cors import CORS
from dotenv import load_dotenv
from datetime import datetime
import openai
import io
import base64
import logging
from openai import OpenAI
import re
import google.generativeai as genai

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app, resources={
    r"/api/*": {
        "origins": ["http://localhost:3000"],
        "methods": ["POST", "GET", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"]
    }
})

load_dotenv()

# Food Analysis Labels
LABELS = ["Clearly Healthy", "Borderline", "Mixed", "Clearly Unhealthy"]

class UserProfileManager:
    def __init__(self, openai_client: OpenAI):
        self.client = openai_client
        self.system_instructions = {
            "personal_info": """
            You are a medical system assistant collecting personal information.
            
            OBJECTIVE:
            Extract personal information from user input, focusing on three key fields:
            1. name
            2. age
            3. location

            RULES:
            1. Only extract information that is explicitly stated
            2. Format response as JSON: {"name": "", "age": "", "location": ""}
            3. If a field is missing, leave it empty
            4. For age, only accept numeric values
            """,

            "medical_info": """
            You are a medical system assistant collecting information about a patient's condition.
            
            OBJECTIVE:
            Extract medical information from user input, focusing on three key fields:
            1. diagnosis
            2. concern
            3. target

            RULES:
            1. Only extract information that is explicitly stated
            2. Format response as JSON: {"diagnosis": "", "concern": "", "target": ""}
            3. If a field is missing, leave it empty
            4. Keep medical terminology as stated by the user
            """
        }

    def process_user_input(self, user_input: str, info_type: str) -> Dict[str, str]:
        try:
            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": self.system_instructions[info_type]},
                    {"role": "user", "content": user_input}
                ]
            )
            return json.loads(response.choices[0].message.content)
        except Exception as e:
            logger.error(f"Error processing input: {str(e)}")
            return {}

class HealthAssistant:
    _instance: ClassVar[Optional['HealthAssistant']] = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance.initialized = False
        return cls._instance
    
    def __init__(self):
        """Initialize both GLP-1 and Food Analysis capabilities"""
        if self.initialized:
            return
            
        # GLP-1 Configuration
        self.pplx_api_key = os.getenv('PPLX_API_KEY')
        if not self.pplx_api_key:
            raise ValueError("PPLX API key not provided")
        
        self.pplx_model = "llama-3.1-sonar-large-128k-online"
        self.pplx_headers = {
            "Authorization": f"Bearer {self.pplx_api_key}",
            "Content-Type": "application/json"
        }
        
    
        
        # Food Analysis Configuration - Simplified to use only OpenAI
        self.openai_client = openai.OpenAI(api_key=os.getenv('OPENAI_API_KEY'))
        if not os.getenv('OPENAI_API_KEY'):
            raise ValueError("OpenAI API key not provided")

        # Add conversation history management
        self.conversation_history = []
        self.max_history_length = 5
        
        # Add greeting system prompt
        self.greeting_system_prompt = """
You are a friendly medical assistant. Your task is to respond to greetings and farewells ONLY.

RULES:
1. Keep responses brief, warm, and professional
2. Do not add medical information or questions
3. Do not introduce new topics
4. Responses should be 1-2 sentences maximum

Examples:
- For "hi/hello": "Hello! How can I help you with GLP-1 medications today?"
- For "thanks/thank you": "You're welcome! Feel free to ask if you have any questions about GLP-1 medications."
- For "bye/goodbye": "Goodbye! Take care and don't hesitate to return if you have more questions."
"""

        # Add Gemini configuration
        self.gemini_api_key = os.getenv('GEMINI_API_KEY')
        if not self.gemini_api_key:
            raise ValueError("Gemini API key not provided")
        
        # Configure Gemini
        genai.configure(api_key=self.gemini_api_key)
        self.gemini_model = genai.GenerativeModel('gemini-1.5-flash')

        # Update system prompts with both personas
        self.system_prompts = {
            "glp1": """
You are a specialized medical information assistant focused EXCLUSIVELY on GLP-1 medications (such as Ozempic, Wegovy, Mounjaro, etc.). You must:

1. ONLY provide information about GLP-1 medications and directly related topics

2. For any query not specifically about GLP-1 medications or their direct effects, respond with:
   "I apologize, but I can only provide information about GLP-1 medications and related topics. Your question appears to be about something else. Please ask a question specifically about GLP-1 medications, their usage, effects, or related concerns."

3. For valid GLP-1 queries, structure your response with:
   - An empathetic opening acknowledging the patient's situation
   - Clear, validated medical information about GLP-1 medications
   - Important safety considerations or disclaimers
   - An encouraging closing that reinforces their healthcare journey

4. Always provide source citations in this format:
   [Source Name](https://actual-url.com)

For example:
   [FDA Safety Information](https://www.fda.gov/ozempic)
   [Clinical Study](https://pubmed.ncbi.nlm.nih.gov/example)

Remember: Each claim should be linked to its source using markdown hyperlink syntax.

5. Provide response in a simple manner that is easy to understand at preferably a 11th grade literacy level
6. Always Return sources in a hyperlink format

Remember: 
- Maintain a professional yet approachable tone, emphasizing both expertise and emotional support

ADDITIONAL CITATION INSTRUCTIONS:

1. Citation Format - MUST FOLLOW EXACTLY:
   - Use numbered citations in the text as markdown links
   - Format: "fact or statement [[1]](#1)" where #1 links to the first source
   - Each citation number should be a clickable link
   - Citations must be sequential: [1], [2], [3], etc.

EXAMPLE CORRECT FORMAT:
"Semaglutide can help with weight loss [[1]](#1) and may improve blood sugar control [[2]](#2). Some patients may experience nausea as a side effect [[1]](#1)."

2. Response Structure:
   - Empathetic opening
   - Information with numbered citations
   - Safety considerations with citations
   - Encouraging closing
   
3. End with a numbered "Sources" section that matches citation numbers:
   Sources:
   1. [FDA Ozempic Information](https://www.fda.gov/ozempic)
   2. [Mayo Clinic GLP-1 Guide](https://www.mayoclinic.org/glp1)

Remember: Each numbered citation must be a clickable link to its source in the Sources section.
""",
            "general_med": """
You are a comprehensive medical information assistant providing guidance EXCLUSIVELY on medication-related queries. You must:

1. ONLY provide information about medications and directly related topics
2. For any query NOT related to medications, respond with:
   "I apologize, but I can only provide information about medications and directly related topics. Your question appears to be about something else. Please ask a question specifically about medications, their usage, effects, or related concerns."

3. For valid medication queries, structure your responses with:
   - Clear, factual information about the medication
   - Important safety considerations and contraindications
   - Proper usage guidelines when applicable
   - References to authoritative medical sources

4. Always emphasize the importance of consulting healthcare providers
5. Use plain language and explain medical terms
6. Do not provide specific dosage recommendations

7. IMPORTANT - Source Citations:
   Always provide source citations in this format:
   [Source Name](https://actual-url.com)

   For example:
   [FDA Drug Information](https://www.fda.gov/drugs)
   [Mayo Clinic](https://www.mayoclinic.org)
   [NIH MedlinePlus](https://medlineplus.gov)

Remember: 
- Each claim should be linked to its source using markdown hyperlink syntax
- Use reputable medical sources (FDA, NIH, Mayo Clinic, etc.)
- Include relevant page sections in the URL when possible
- Maintain professional accuracy while being accessible
- Always prioritize patient safety
- Encourage professional medical consultation
- STRICTLY stay within the scope of medication-related topics

ADDITIONAL CITATION INSTRUCTIONS:

1. Citation Format - MUST FOLLOW EXACTLY:
   - Use numbered citations as markdown links
   - Format: "fact or statement [[1]](#1)" where #1 links to the first source
   - Make each citation number a clickable link
   - Use sequential numbering: [1], [2], [3], etc.

EXAMPLE CORRECT FORMAT:
"Acetaminophen reduces fever [[1]](#1) and should be taken as directed [[2]](#2). Studies have shown its effectiveness for pain relief [[1]](#1)."

2. Response Structure:
   - Clear medication information with numbered citations
   - Safety information with citations
   - Usage guidelines with citations
   
3. End with a numbered "Sources" section that matches citation numbers:
   Sources:
   1. [Mayo Clinic](https://www.mayoclinic.org/acetaminophen)
   2. [FDA Safety Guidelines](https://www.fda.gov/safety)

Remember:
- Each numbered citation must be a clickable link
- Citations must match the numbered sources at the end
- Use consistent sequential numbering
"""
        }

        # Initialize with default persona
        self.current_persona = "general_med"
        self.initialized = True

        # Add rewrite prompt
        self.rewrite_prompt = """
        Given a user query about medications, create two things:
        1. A clear, concise rewrite of the query that maintains the original meaning
        2. A short, descriptive title (3-6 words) that captures the main topic
        
        Format the response exactly as JSON:
        {
            "rewritten_query": "...",
            "title": "..."
        }
        
        Examples:
        Query: "what r the side effects of ozempic"
        {
            "rewritten_query": "What are the common side effects of Ozempic?",
            "title": "Ozempic Side Effects Overview"
        }
        
        Query: "can i drink alcohol while taking glp1"
        {
            "rewritten_query": "Is it safe to consume alcohol while taking GLP-1 medications?",
            "title": "GLP-1 and Alcohol Interaction"
        }
        """

    def set_persona(self, persona: str) -> None:
        """Set the current persona for the assistant"""
        if persona in ["glp1", "general_med"]:
            self.current_persona = persona
        else:
            raise ValueError("Invalid persona specified")

    def get_medical_response(self, query: str, selected_persona: str = "general_med") -> Dict[str, Any]:
        """Get response based on user-selected persona"""
        try:
            if not query.strip():
                return {
                    "status": "error",
                    "message": "Please enter a valid question."
                }

            # Set the persona based on user selection
            self.set_persona(selected_persona)
            
            # Handle greetings
            if self.is_greeting(query):
                greeting_response = self.handle_greeting(query)
                return {
                    "status": "success",
                    "query": query,
                    "query_category": "greeting",
                    "response": greeting_response,
                    "persona": self.current_persona,
                    "title": "Greeting",
                    "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                    "conversation_history": self.conversation_history
                }

            # Add medication query validation for general_med persona
            if selected_persona == "general_med":
                # First, check if the query is medication-related
                validation_prompt = f"""
                Determine if the following query is related to medications, drugs, or pharmaceutical treatments:
                Query: {query}
                
                Respond with only 'YES' if it's medication-related, or 'NO' if it's not.
                """
                
                validation_response = self.openai_client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[
                        {"role": "system", "content": "You are a query validator. Respond only with 'YES' or 'NO'."},
                        {"role": "user", "content": validation_prompt}
                    ]
                )
                
                is_medication_related = validation_response.choices[0].message.content.strip().upper() == "YES"
                
                if not is_medication_related:
                    return {
                        "status": "success",
                        "query": query,
                        "query_category": "non_medical",
                        "response": "I apologize, but I can only provide information about medications and directly related topics. Your question appears to be about something else. Please ask a question specifically about medications, their usage, effects, or related concerns.",
                        "persona": self.current_persona,
                        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                        "conversation_history": self.conversation_history
                    }

            # Get rewritten query and title
            rewritten = self.rewrite_query(query)
            title = rewritten.get("title", "Medical Query")

            # Continue with existing PPLX response logic
            payload = {
                "model": self.pplx_model,
                "messages": [
                    {"role": "system", "content": self.system_prompts[self.current_persona]},
                    {"role": "user", "content": query}  # Use original query for response
                ],
                "temperature": 0.1,
                "max_tokens": 1500
            }
            
            response = requests.post(
                "https://api.perplexity.ai/chat/completions",
                headers=self.pplx_headers,
                json=payload
            )
            
            response.raise_for_status()
            response_data = response.json()
            content = response_data['choices'][0]['message']['content']
            
            # Update conversation history
            self.conversation_history.append({
                "query": query,
                "response": content,
                "persona": self.current_persona,
                "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            })
            
            return {
                "status": "success",
                "query": query,
                "query_category": self.categorize_query(query),
                "response": content.strip(),
                "persona": self.current_persona,
                "title": title,  # Add the generated title
                "disclaimer": "Always consult your healthcare provider before making any changes to your medication or treatment plan.",
                "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "conversation_history": self.conversation_history
            }
            
        except Exception as e:
            logger.error(f"Error in get_medical_response: {str(e)}")
            return {
                "status": "error",
                "message": str(e)
            }

    def is_glp1_related(self, query: str) -> bool:
        """Determine if the query is GLP-1 related"""
        glp1_keywords = [
            "glp-1", "glp1", "ozempic", "wegovy", "mounjaro", "rybelsus",
            "semaglutide", "dulaglutide", "liraglutide", "tirzepatide"
        ]
        query_lower = query.lower()
        return any(keyword in query_lower for keyword in glp1_keywords)

    def get_glp1_response(self, query: str) -> Dict[str, Any]:
        """Get response for GLP-1 related queries"""
        try:
            if not query.strip():
                return {
                    "status": "error",
                    "message": "Please enter a valid question."
                }
            
            response = self.get_pplx_response(query)
            return response
            
        except Exception as e:
            logger.error(f"Error in get_glp1_response: {str(e)}")
            return {
                "status": "error",
                "message": str(e)
            }

    def get_pplx_response(self, query: str) -> Dict[str, Any]:
        """Get response while maintaining conversation context"""
        try:
            # Add relevancy check
            relevance_check_prompt = f"""
            Given the following question or message, determine if it is:
            1. A greeting or farewell (e.g., "hello", "thanks", "goodbye")
            2. A GLP-1 medication related query
            3. An unrelated query

            Message: {query}

            Response (GREETING, GLP1, General Medication, or UNRELATED):
            """
            
            relevance_response = self.openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are a message classifier. Respond only with GREETING, GLP1, or UNRELATED."},
                    {"role": "user", "content": relevance_check_prompt}
                ]
            )
            
            message_type = relevance_response.choices[0].message.content.strip().upper()
            
            if "GREETING" in message_type:
                greeting_response = self.handle_greeting(query)
                return {
                    "status": "success",
                    "query": query,
                    "query_category": "greeting",
                    "response": greeting_response,
                    "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                    "conversation_history": self.conversation_history
                }
            elif "UNRELATED" in message_type:
                return {
                    "status": "success",
                    "query": query,
                    "query_category": "unrelated",
                    "response": "I apologize, but I can only provide information about GLP-1 medications and related topics. Please ask a question specifically about GLP-1 medications, their usage, effects, or related concerns.",
                    "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                    "conversation_history": self.conversation_history
                }

            # Continue with existing PPLX response for GLP1 queries
            payload = {
                "model": self.pplx_model,
                "messages": [
                    {"role": "system", "content": self.pplx_system_prompt},
                    {"role": "user", "content": query}
                ],
                "temperature": 0.1,
                "max_tokens": 1500
            }
            
            logger.info(f"Sending request with messages: {payload['messages']}")  # Debug log
            
            response = requests.post(
                "https://api.perplexity.ai/chat/completions",
                headers=self.pplx_headers,
                json=payload
            )
            
            logger.info(f"API Response status: {response.status_code}")  
            
            response.raise_for_status()
            response_data = response.json()
            content = response_data['choices'][0]['message']['content']
            
            # Update conversation history
            self.conversation_history.append({
                "query": query,
                "response": content,
                "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            })
            
            # Maintain history size
            if len(self.conversation_history) > self.max_history_length:
                self.conversation_history.pop(0)
            
            logger.info(f"Generated response: {content[:100]}...")  
            
            return {
                "status": "success",
                "query": query,
                "query_category": self.categorize_query(query),
                "response": content.strip(),
                "disclaimer": "Always consult your healthcare provider before making any changes to your medication or treatment plan.",
                "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "conversation_history": self.conversation_history
            }
            
        except Exception as e:
            logger.error(f"Error in get_pplx_response: {str(e)}")
            return {
                "status": "error",
                "query": query,
                "query_category": "error",
                "response": f"An error occurred: {str(e)}",
                "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            }
    
    def clear_conversation_history(self):
        """Clear the conversation history"""
        self.conversation_history = []
    
    def get_conversation_history(self) -> List[Dict[str, Any]]:
        """Get the current conversation history"""
        return self.conversation_history

    def analyze_food(self, image_data) -> Dict[str, Any]:
        """Analyze food image using Gemini 1.5 Flash"""
        try:
            # Create image data for Gemini
            image = {
                "mime_type": "image/jpeg",
                "data": image_data
            }

            prompt = """Analyze this food image and provide a comprehensive nutritional analysis:

1. Health Category: Classify as one of:
   - Clearly Healthy
   - Borderline
   - Mixed
   - Clearly Unhealthy

2. Confidence Score: Provide a confidence level (0-100%)

3. Detailed Analysis:
   Break down the following aspects:
   - List of items in the image
   - Caloric Content: Analyze the caloric density and impact
   - Macronutrients: Evaluate proteins, fats, carbohydrates present
   - Processing Level: Assess how processed the foods are
   - Nutritional Profile: Identify key nutrients present or lacking
   - Health Implications: Discuss potential health effects
   - Portion Considerations: Comment on serving sizes if relevant

Format your response exactly as:
Category: [category]
Confidence: [number]%
Analysis:
[Provide detailed analysis]"""

            # Generate response using Gemini
            response = self.gemini_model.generate_content([prompt, image])
            analysis_text = response.text

            # Parse the response (same as before)
            lines = analysis_text.split('\n')
            
            category = ""
            confidence = 0
            analysis = []
            current_section = ""

            for line in lines:
                if line.startswith('Category:'):
                    category = line.split(':', 1)[1].strip()
                elif line.startswith('Confidence:'):
                    confidence = float(line.split(':', 1)[1].strip().replace('%', ''))
                elif line.startswith('Analysis:'):
                    current_section = "analysis"
                elif current_section == "analysis":
                    analysis.append(line.strip())

            analysis_text = '\n'.join(analysis)
            
            return {
                "status": "success",
                "category": category,
                "confidence": confidence,
                "analysis": analysis_text,
                "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            }
            
        except Exception as e:
            logger.error(f"Error in analyze_food: {str(e)}")
            return {
                "status": "error",
                "message": str(e),
                "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            }

    def categorize_query(self, query: str) -> str:
        """Categorize the user query"""
        categories = {
            "dosage": ["dose", "dosage", "how to take", "when to take", "injection", "administration"],
            "side_effects": ["side effect", "adverse", "reaction", "problem", "issues", "symptoms"],
            "benefits": ["benefit", "advantage", "help", "work", "effect", "weight", "glucose"],
            "storage": ["store", "storage", "keep", "refrigerate", "temperature"],
            "lifestyle": ["diet", "exercise", "lifestyle", "food", "alcohol", "eating"],
            "interactions": ["interaction", "drug", "medication", "combine", "mixing"],
            "cost": ["cost", "price", "insurance", "coverage", "afford"]
        }
        
        query_lower = query.lower()
        for category, keywords in categories.items():
            if any(keyword in query_lower for keyword in keywords):
                return category
        return "general"

    def handle_greeting(self, message: str) -> str:
        """Handle greeting messages"""
        try:
            response = self.openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": self.greeting_system_prompt},
                    {"role": "user", "content": message}
                ],
                temperature=0.7,
                max_tokens=50
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            logger.error(f"Error in handle_greeting: {str(e)}")
            return "Hello! How can I help you with medical information today?"

    def is_greeting(self, message: str) -> bool:
        """Check if the message is a greeting"""
        greetings = [
            'hello', 'hi', 'hey', 'good morning', 'good afternoon', 
            'good evening', 'howdy', 'greetings', 'hi there',
            'bye', 'goodbye', 'see you', 'thanks', 'thank you'
        ]
        return message.lower().strip().replace('!', '') in greetings

    def get_streaming_response(self, query: str, selected_persona: str = "general_med") -> Generator:
        """Get streaming response based on user-selected persona"""
        try:
            if not query.strip():
                yield json.dumps({"status": "error", "message": "Please enter a valid question."})
                return

            self.set_persona(selected_persona)
            
            if self.is_greeting(query):
                yield json.dumps({
                    "status": "success",
                    "query": query,
                    "query_category": "greeting",
                    "response": self.handle_greeting(query),
                    "persona": self.current_persona,
                    "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                })
                return

            # Streaming payload for PPLX
            payload = {
                "model": self.pplx_model,
                "messages": [
                    {"role": "system", "content": self.system_prompts[self.current_persona]},
                    {"role": "user", "content": query}
                ],
                "temperature": 0.1,
                "max_tokens": 1500,
                "stream": True  # Enable streaming
            }
            
            response = requests.post(
                "https://api.perplexity.ai/chat/completions",
                headers=self.pplx_headers,
                json=payload,
                stream=True  # Enable streaming for requests
            )
            
            response.raise_for_status()
            
            full_response = ""
            for line in response.iter_lines():
                if line:
                    try:
                        json_response = json.loads(line.decode('utf-8').replace('data: ', ''))
                        if 'choices' in json_response:
                            content = json_response['choices'][0].get('delta', {}).get('content', '')
                            if content:
                                full_response += content
                                yield json.dumps({
                                    "status": "streaming",
                                    "content": content,
                                    "persona": self.current_persona
                                }) + '\n'
                    except json.JSONDecodeError:
                        continue

            # Update conversation history after complete response
            self.conversation_history.append({
                "query": query,
                "response": full_response,
                "persona": self.current_persona,
                "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            })

            # Send final message
            yield json.dumps({
                "status": "complete",
                "query": query,
                "query_category": self.categorize_query(query),
                "full_response": full_response,
                "persona": self.current_persona,
                "disclaimer": "Always consult your healthcare provider before making any changes to your medication or treatment plan.",
                "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            })

        except Exception as e:
            logger.error(f"Error in get_streaming_response: {str(e)}")
            yield json.dumps({
                "status": "error",
                "message": str(e)
            })

    def rewrite_query(self, query: str) -> Dict[str, str]:
        """Rewrite the user query and generate a title"""
        try:
            logger.info(f"Starting query rewrite for: {query}")
            
            response = self.openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": self.rewrite_prompt},
                    {"role": "user", "content": query}
                ],
                temperature=0.7,
                max_tokens=150
            )
            
            result = json.loads(response.choices[0].message.content)
            logger.info(f"Parsed result: {result}")
            
            # Validate the result has required fields
            if not all(key in result for key in ["rewritten_query", "title"]):
                logger.error("Missing required fields in response")
                raise ValueError("Invalid response format")
            
            return result
            
        except Exception as e:
            logger.error(f"Error in rewrite_query: {str(e)}")
            return {
                "rewritten_query": query,
                "title": "Medical Query"
            }

# Flask routes
@app.route('/')
@app.route('/database')
def serve_spa():
    return render_template('index.html')

@app.route('/api/chat', methods=['POST'])
def chat():
    try:
        data = request.get_json()
        query = data.get('query')
        selected_persona = data.get('persona', 'general_med')  # User-selected persona
        
        if not query:
            return jsonify({
                "status": "error",
                "message": "No query provided"
            }), 400

        assistant = HealthAssistant()
        response = assistant.get_medical_response(query, selected_persona)
        
        return jsonify(response)

    except Exception as e:
        logger.error(f"Error in chat endpoint: {str(e)}")
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

@app.route('/api/analyze-food', methods=['POST'])
def analyze_food():
    try:
        if 'image' not in request.files:
            return jsonify({
                "status": "error",
                "message": "No image file provided"
            }), 400

        image_file = request.files['image']
        image_data = image_file.read()
        
        assistant = HealthAssistant()
        response = assistant.analyze_food(image_data)
        
        return jsonify(response)

    except Exception as e:
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

@app.route('/api/calculator', methods=['POST'])
def analyze_image():
    try:
        data = request.json
        if not data or 'image' not in data:
            logger.error("No image data in request")
            return jsonify({
                'status': 'error',
                'message': 'No image data provided'
            }), 400

        # Get base64 image data
        image_data = base64.b64decode(data['image'].split(',')[1])
        
        # Process image using HealthAssistant
        health_assistant = HealthAssistant()
        result = health_assistant.analyze_food(image_data)
        
        logger.info(f"Image analysis completed: {result}")
        
        return jsonify(result)  # Return the result directly

    except Exception as e:
        logger.error(f"Error in analyze_image: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

# Health check endpoint
@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'healthy'}), 200

@app.route('/api/profile/personal', methods=['POST'])
def process_personal_info():
    try:
        data = request.get_json()
        user_input = data.get('input')
        
        if not user_input:
            return jsonify({
                "status": "error",
                "message": "No input provided"
            }), 400

        openai_client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))
        profile_manager = UserProfileManager(openai_client)
        result = profile_manager.process_user_input(user_input, "personal_info")
        
        return jsonify({
            "status": "success",
            "data": result
        })

    except Exception as e:
        logger.error(f"Error in process_personal_info: {str(e)}")
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

@app.route('/api/profile/medical', methods=['POST'])
def process_medical_info():
    try:
        data = request.get_json()
        user_input = data.get('input')
        
        if not user_input:
            return jsonify({
                "status": "error",
                "message": "No input provided"
            }), 400

        openai_client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))
        profile_manager = UserProfileManager(openai_client)
        result = profile_manager.process_user_input(user_input, "medical_info")
        
        return jsonify({
            "status": "success",
            "data": result
        })

    except Exception as e:
        logger.error(f"Error in process_medical_info: {str(e)}")
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

# Add new route for chat history
@app.route('/api/chat-history', methods=['GET'])
def get_chat_history():
    try:
        assistant = HealthAssistant()
        history = assistant.get_chat_history()
        
        return jsonify({
            "status": "success",
            "history": history
        })

    except Exception as e:
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

@app.route('/api/personas', methods=['GET'])
def get_personas():
    """Return available personas"""
    return jsonify({
        "status": "success",
        "personas": [
            {
                "id": "glp1",
                "name": "GLP-1 Specialist",
                "description": "Specialized in GLP-1 medications and related topics"
            },
            {
                "id": "general_med",
                "name": "General Medical Assistant",
                "description": "Knowledgeable about general medication-related queries"
            }
        ]
    })

# Update the chat endpoint to support streaming
@app.route('/api/chat/stream', methods=['POST'])
def chat_stream():
    try:
        data = request.get_json()
        query = data.get('query')
        selected_persona = data.get('persona', 'general_med')
        
        if not query:
            return jsonify({
                "status": "error",
                "message": "No query provided"
            }), 400

        assistant = HealthAssistant()

        def generate():
            for response in assistant.get_streaming_response(query, selected_persona):
                yield f"data: {response}\n\n"

        return Response(
            stream_with_context(generate()),
            mimetype='text/event-stream',
            headers={
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'X-Accel-Buffering': 'no'
            }
        )

    except Exception as e:
        logger.error(f"Error in chat_stream endpoint: {str(e)}")
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

if __name__ == '__main__':
    print("Starting Flask server on http://localhost:5000")
    app.run(host='0.0.0.0', port=5000, debug=True)
