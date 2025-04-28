import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';

// Initialize Gemini Pro Vision
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '');
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

// CORS headers configuration
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// System prompt for food analysis with user-friendly format
const FOOD_ANALYSIS_PROMPT = `You are a helpful assistant that summarizes meal analysis results in a friendly, user-focused tone. Your goal is to avoid technical jargon and make the summary feel natural and easy to understand.

Given the "before" and "after" photos of a meal, first perform these validations:

1. Check if they show the same food items. If different, respond with exactly:

These appear to be different meals. Please take before and after photos of the same meal for accurate tracking, or switch to the meal stitch feature.

2. Check the meal completion state:
   - If both images show complete/uneaten meals, or
   - If both images show partially eaten/finished meals
   Respond with exactly:

Please ensure you're uploading images of the same meal before and after eating for accurate tracking, or switch to the meal stitch feature.

If the validation passes (same food items, and shows proper before/after eating progress), analyze what was eaten and provide a clear, human-readable summary with the following structure:

1. **What was eaten:** Briefly list the key components of the meal (group similar ingredients together when possible, e.g., "a mix of fresh veggies" instead of listing each).
2. **How much was eaten:** Mention the estimated portion consumed in plain language (e.g., "about three-quarters of your meal").
3. **What was left:** Highlight any noticeable leftovers on the plate, if mentioned.
4. **Overall reflection:** Include a positive, encouraging summary of the meal's nutritional balance (e.g., "A nice mix of protein, carbs, and veggies").

Keep the tone friendly, casual, and supportive. Avoid using exact numbers like grams or calories unless they're helpful or specifically requested.

Present your response in this exact format:

**Meal Summary**
• You ate [key components of the meal]
• You finished [estimated portion consumed in plain language]
• Left on your plate: [any noticeable leftovers]
• Overall: [positive, encouraging summary of nutritional balance]`;


export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get('content-type') || '';
    
    let beforeImageData, afterImageData;
    
    if (contentType.includes('multipart/form-data')) {
      // Handle form data (web uploads)
      const formData = await request.formData();
      const beforeImage = formData.get('beforeImage') as File;
      const afterImage = formData.get('afterImage') as File;

      if (!beforeImage || !afterImage) {
        return NextResponse.json(
          { success: false, error: 'Both before and after images are required' },
          { status: 400, headers: corsHeaders }
        );
      }

      const beforeBuffer = Buffer.from(await beforeImage.arrayBuffer());
      const afterBuffer = Buffer.from(await afterImage.arrayBuffer());

      beforeImageData = {
        inlineData: {
          data: beforeBuffer.toString('base64'),
          mimeType: "image/jpeg"
        }
      };

      afterImageData = {
        inlineData: {
          data: afterBuffer.toString('base64'),
          mimeType: "image/jpeg"
        }
      };
    } else {
      // Handle JSON payload (mobile app)
      const body = await request.json();
      
      if (!body.beforeImage || !body.afterImage) {
        return NextResponse.json(
          { success: false, error: 'Both before and after images are required' },
          { status: 400, headers: corsHeaders }
        );
      }

      // Expect base64 strings from mobile
      beforeImageData = {
        inlineData: {
          data: body.beforeImage,
          mimeType: "image/jpeg"
        }
      };

      afterImageData = {
        inlineData: {
          data: body.afterImage,
          mimeType: "image/jpeg"
        }
      };
    }

    // Call Gemini for analysis
    const result = await model.generateContent([
      FOOD_ANALYSIS_PROMPT,
      beforeImageData,
      afterImageData
    ]);

    const response = await result.response;
    const analysisText = response.text();
    
    return NextResponse.json({
      success: true,
      analysis: analysisText
    }, { headers: corsHeaders });
  } catch (error) {
    console.error('Error in food analysis:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'An error occurred during food analysis' 
      },
      { status: 500, headers: corsHeaders }
    );
  }
}
