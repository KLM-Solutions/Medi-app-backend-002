// app/api/calculator/route.ts
import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from 'zod';

// Analysis prompt for food image processing
const ANALYSIS_PROMPT = `Analyze this food image and provide a comprehensive nutritional analysis:

1. Health Category: Classify as one of:
   - Clearly Healthy
   - Borderline
   - Mixed
   - Clearly Unhealthy

2. Confidence Score: Provide a confidence level (0-100%)

3. Detailed Analysis:
   Break down the following aspects:
   - Items Identified: List the items in the image 
   - Caloric Content: Analyze the caloric density and impact 
   - Macronutrients: Evaluate proteins, fats, carbohydrates present 
   - Processing Level: Assess how processed the foods are
   - Nutritional Profile: Identify key nutrients present or lacking
   - Health Implications: Discuss potential health effects
   - Portion Considerations: Comment on serving sizes if relevant

4. Nutritional Information:
   Based on standard serving size or visible portion, estimate the following values.
   If exact values cannot be determined, provide a reasonable range based on standard nutritional databases.
   DO NOT return NaN or leave values empty. Use approximations based on similar foods if needed.

   Dish Name: [name of the dish]
   Estimated Serving Size: [number] g/ml
   Calories: [number, use range if uncertain e.g. 300-350] kcal

   Macronutrients (per serving):
   - Carbohydrates: [number or range] g
   - Proteins: [number or range] g
   - Fats: [number or range] g
   - Fiber: [number or range] g
   - Water Content: [number or range] ml

   
Format your response exactly as:
Category: [category]
Confidence: [number]%

[Provide detailed analysis starting with items identified, don't mention "analysis" as heading]

[Formatted nutritional breakdown as specified above]`;

// Medication alert prompt template
const MEDICATION_ALERT_PROMPT = `Based on the food image analysis and the user's medication details, provide a brief medication alert about potential interactions.The goal is to provide not just warnings, but a helpful and balanced analysis—especially for users managing chronic conditions like hypertension, diabetes, or high cholesterol.
Medications:
{{medications}}
Instructions:
Your task:
Identify any food–medication interactions or influences on efficacy
Categorize findings using the following:
Category: ["Direct Interaction", "Efficacy Consideration", "Nutritional Synergy", "No Known Concern"]
Severity: ["Low", "Moderate", "High"]
Alert: A two-line summary explaining either the concern or helpful tip
Recommendation: Optional tip about moderation, timing, or complementary foods to offset risk or boost benefit
Guidance:
Do not issue black-and-white “avoid this” warnings unless medically critical.
If the food might blunt the medication’s effect (e.g., high sodium reducing BP med efficacy), clearly state that.
If the food offers no concern or even complements the medication’s goal, highlight it positively.
Avoid over-medicalizing. Speak like a supportive health coach.
If no concerns exist:
Category: No Known Concern 
Alert: No meaningful interactions or concerns with this meal and medication. 
`;

// Initialize Gemini Pro Vision

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '');
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

// Request validation schema
const requestSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(['user', 'assistant', 'system']),
      content: z.string(),
      id: z.string().optional()
    })
  ),
  body: z.object({
    maxTokens: z.number().optional(),
    temperature: z.number().optional(),
    medications: z.array(
      z.object({
        name: z.string(),
        dosage: z.string(),
        frequency: z.string(),
        timeOfDay: z.array(z.string()),
        notes: z.string().optional()
      })
    ).optional()
  }).optional()
});

// Analysis request schema for the parsed content
const analysisRequestSchema = z.object({
  type: z.literal('analysis_request'),
  image: z.string(),
  medications: z.array(
    z.object({
      name: z.string(),
      dosage: z.string(),
      frequency: z.string(),
      timeOfDay: z.array(z.string()),
      notes: z.string().optional()
    })
  ).optional()
});

function extractImageData(base64Url: string) {
  // Remove data URL prefix if present
  const base64Data = base64Url.replace(/^data:image\/\w+;base64,/, '');
  // Convert base64 to uint8array
  return new Uint8Array(Buffer.from(base64Data, 'base64'));
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validatedData = requestSchema.parse(body);
    
    // Parse the message content
    const lastMessage = validatedData.messages[validatedData.messages.length - 1];
    let parsedContent;
    try {
      parsedContent = JSON.parse(lastMessage.content);
    } catch (error) {
      throw new Error('Invalid JSON in message content');
    }
    
    const analysisRequest = analysisRequestSchema.parse(parsedContent);
    
    const imageData = analysisRequest.image;
    if (!imageData) {
      throw new Error('No image data provided');
    }

    // Get medications from the request if available
    const medications = analysisRequest.medications || [];

    // Extract and prepare the image data
    const imageBytes = extractImageData(imageData);

    // Generate food analysis content
    const result = await model.generateContent({
      contents: [{
        role: "user",
        parts: [
          { text: ANALYSIS_PROMPT },
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: Buffer.from(imageBytes).toString('base64')
            }
          }
        ]
      }]
    });

    // Get the full food analysis text
    const fullAnalysisText = result.response.text();
    
    // Prepare response object
    const responseData = {
      analysis: fullAnalysisText,
      medication_alert: null as string | null
    };

    // Check if we need to generate medication alerts
    if (medications && medications.length > 0) {
      // Format medications for the prompt
      const medicationsText = medications.map(med => 
        `- ${med.name} (${med.dosage}, ${med.frequency}, taken: ${med.timeOfDay.join(', ')})${med.notes ? ` - Notes: ${med.notes}` : ''}`
      ).join('\n');
      
      // Prepare the medication alert prompt
      const alertPrompt = MEDICATION_ALERT_PROMPT.replace('{{medications}}', medicationsText);
      
      // Generate medication alert
      const alertResult = await model.generateContent({
        contents: [
          {
            role: "user",
            parts: [
              { text: fullAnalysisText }
            ]
          },
          {
            role: "assistant",
            parts: [
              { text: fullAnalysisText }
            ]
          },
          {
            role: "user",
            parts: [
              { text: alertPrompt }
            ]
          }
        ]
      });
      
      const medicationAlertText = alertResult.response.text();
      responseData.medication_alert = medicationAlertText;
    }

    // Return the complete response
    return NextResponse.json(responseData);

  } catch (error) {
    console.error('Error in POST handler:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        status: 'error',
        message: 'Invalid request format',
        details: error.errors
      }, { status: 400 });
    }

    return NextResponse.json({
      status: 'error',
      message: error instanceof Error ? error.message : 'An unknown error occurred',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

// Support OPTIONS for CORS preflight
export async function OPTIONS(request: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
