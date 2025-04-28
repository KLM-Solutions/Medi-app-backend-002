// app/api/chat/route.ts
import { openai } from '@ai-sdk/openai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { streamText } from 'ai';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import OpenAI from 'openai';

export const maxDuration = 60;

// Message type enum
enum MessageType {
  GREETING = 'GREETING',
  GLP1 = 'GLP1',
  GENERAL_MEDICATION = 'GENERAL_MEDICATION',
  UNRELATED = 'UNRELATED'
}

// Initialize OpenAI client for relevance checking
const openaiClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Initialize Perplexity client
const perplexity = createOpenAICompatible({
  name: 'perplexity',
  apiKey: process.env.PPLX_API_KEY,
  baseURL: 'https://api.perplexity.ai/',
});

// Request validation schema
const requestSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(['user', 'assistant', 'system']),
      content: z.string()
    })
  ),
  data: z.object({
    persona: z.enum(['general_med', 'glp1']),
    includeHistory: z.boolean().default(true)
  })
});

// System prompts
const SYSTEM_PROMPTS = {
  greeting: `You are a friendly medical assistant. Your task is to respond to greetings and farewells ONLY.
RULES:
1. Keep responses brief, warm, and professional
2. Do not add medical information or questions
3. Do not introduce new topics
4. Responses should be 1-2 sentences maximum
5. Never start responses with phrases like "<think>" or "let me think"
Examples:
- For "hi/hello": "Hello! How can I help you with GLP-1 medications today?"
- For "thanks/thank you": "You're welcome! Feel free to ask if you have any questions about GLP-1 medications."
- For "bye/goodbye": "Goodbye! Take care and don't hesitate to return if you have more questions."`,

  glp1: `You are a specialized medical information assistant focused EXCLUSIVELY on GLP-1 medications (such as Ozempic, Wegovy, Mounjaro, etc.). You must:

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

Remember: Each numbered citation must be a clickable link to its source in the Sources section.`,

  general_med: `You are a comprehensive medical information assistant providing guidance EXCLUSIVELY on medication-related queries. You must:

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
- Use consistent sequential numbering`
};

// Add rewrite prompt
const REWRITE_PROMPT = `Given a user query about medications, create two things:
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
    "title": "GLP-1 and Alcohol Interaction"}`;

// Function to rewrite query
async function rewriteQuery(query: string): Promise<{ rewritten_query: string; title: string }> {
  try {
    const response = await openaiClient.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: REWRITE_PROMPT },
        { role: "user", content: query }
      ],
      temperature: 0.7,
      max_tokens: 150
    });

    const content = response.choices[0].message?.content;
    
    // Check if content exists
    if (!content) {
      throw new Error("No content in response");
    }

    const result = JSON.parse(content);

    // Validate the result has required fields
    if (!result.rewritten_query || !result.title) {
      throw new Error("Invalid response format");
    }

    return result;
  } catch (error) {
    console.error('Error in rewrite_query:', error);
    return {
      rewritten_query: query,
      title: "Medical Query"
    };
  }
}

// Direct relevance checking function using OpenAI
async function checkMessageRelevance(message: string): Promise<MessageType> {
  try {
    const response = await openaiClient.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a message classifier. Respond only with GREETING, GLP1, GENERAL_MEDICATION, or UNRELATED."
        },
        {
          role: "user",
          content: `Given the following message, determine if it is:
            1. A greeting or farewell (e.g., "hello", "thanks", "goodbye")
            2. A GLP-1 medication related query
            3. A general medication related query
            4. An unrelated query
            Message: ${message}
            Response (GREETING, GLP1, GENERAL_MEDICATION, or UNRELATED):`
        }
      ],
      temperature: 0,
      max_tokens: 10,
    });

    const messageType = response.choices[0].message?.content?.trim().toUpperCase() || 'UNRELATED';
    
    switch (messageType) {
      case 'GREETING':
        return MessageType.GREETING;
      case 'GLP1':
        return MessageType.GLP1;
      case 'GENERAL_MEDICATION':
        return MessageType.GENERAL_MEDICATION;
      default:
        return MessageType.UNRELATED;
    }
  } catch (error) {
    console.error('Error in relevance check:', error);
    throw new Error('Failed to check message relevance');
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    console.log('=== START REQUEST PROCESSING ===');
    console.log('1. Raw Request Data:');
    console.log('- Incoming persona:', body.data?.persona);
    
    const validatedData = requestSchema.parse(body);
    const { messages, data } = validatedData;
    
    // Get the last user message
    const lastUserMessage = messages[messages.length - 1].content;
    
    // Message type logging
    const messageType = await checkMessageRelevance(lastUserMessage);
    console.log('\n2. Message Classification:');
    console.log('- Message type:', messageType);
    console.log('- Selected persona:', data.persona);

    // Prepare system prompt based on PERSONA FIRST, then message type
    let systemPrompt: string;
    let usePerplexity = false;

    // First check if it's a greeting
    if (messageType === MessageType.GREETING) {
      systemPrompt = SYSTEM_PROMPTS.greeting;
      console.log('- Selected prompt: GREETING');
    } 
    // Then respect the persona choice
    else if (data.persona === 'glp1') {
      systemPrompt = SYSTEM_PROMPTS.glp1;
      usePerplexity = true;
      console.log('- Selected prompt: GLP1 (based on persona)');
      
      // If the message is unrelated to medications, we'll still use GLP1 prompt
      // but the prompt itself will handle the off-topic response
    } 
    else if (data.persona === 'general_med') {
      systemPrompt = SYSTEM_PROMPTS.general_med;
      usePerplexity = true;
      console.log('- Selected prompt: GENERAL_MED (based on persona)');
      
      // If the message is unrelated to medications, we'll still use GENERAL_MED prompt
      // but the prompt itself will handle the off-topic response
    }
    else {
      // Fallback case (shouldn't happen due to zod validation)
      systemPrompt = "You are a medical assistant. Politely explain that you can only help with medical and medication-related questions.";
      console.log('- Selected prompt: DEFAULT');
    }

    // Final configuration logging
    console.log('\n3. Final Configuration:');
    console.log('- Using Perplexity:', usePerplexity);
    console.log('- Final persona:', data.persona);
    console.log('- System prompt length:', systemPrompt.length);
    console.log('=== END REQUEST PROCESSING ===\n');

    // Prepare messages array
    const apiMessages = [
      {
        role: 'system' as const,
        content: systemPrompt
      },
      ...(data.includeHistory ? messages : [messages[messages.length - 1]])
    ];

    // Create streaming response
    const result = usePerplexity ? 
      streamText({
        model: perplexity(process.env.PPLX_MODEL || ''),
        messages: apiMessages.map(msg => ({
          ...msg,
          content: msg.content.replace(/<\/?think>/g, '') // Clean think tags from messages
        })),
        temperature: 0.7,
        maxTokens: 2000
      }) :
      streamText({
        model: openai('gpt-4o-mini'),
        messages: apiMessages.map(msg => ({
          ...msg,
          content: msg.content.replace(/<\/?think>/g, '') // Clean think tags from messages
        })),
        temperature: 0.7,
        maxTokens: 1000
      });

    // Convert to Response and add metadata in headers
    const streamResponse = result.toDataStreamResponse();
    const responseWithMetadata = new Response(
      new ReadableStream({
        async start(controller) {
          const reader = streamResponse.body?.getReader();
          if (!reader) return;
          
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              
              // Clean think tags from the chunk if it's text
              if (value) {
                const cleanedValue = new TextDecoder().decode(value).replace(/<\/?think>/g, '');
                controller.enqueue(new TextEncoder().encode(cleanedValue));
              }
            }
          } finally {
            reader.releaseLock();
            controller.close();
          }
        }
      }),
      {
        headers: {
          ...Object.fromEntries(streamResponse.headers),
          'X-Chat-Title': systemPrompt.length > 10 ? systemPrompt.slice(0, 10) + '...' : systemPrompt,
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      }
    );

    return responseWithMetadata;

  } catch (error) {
    console.error('Error in chat API:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request format', details: error.errors }, { status: 400 });
    }

    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
