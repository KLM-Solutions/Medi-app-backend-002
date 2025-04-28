import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export async function POST(request: Request) {
    try {
      const { originalMessage, analysis } = await request.json();
  
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a medical AI assistant specializing in providing clear, accurate, and helpful responses about GLP-1 medications. Your task is to generate an improved version of a previous response based on feedback analysis."
          },
          {
            role: "user",
            content: `Original response: "${originalMessage}"
            
  Analysis of issues: "${analysis}"
  
  Please provide an improved version of this response that addresses the identified issues while maintaining accuracy and helpfulness.`
          }
        ],
        temperature: 0.7,
        max_tokens: 1000
      });
  
      return NextResponse.json({
        status: 'success',
        response: completion.choices[0].message.content
      });
  
    } catch (error: any) {
      console.error('Error generating improved response:', error);
      return NextResponse.json({
        status: 'error',
        message: error.message
      }, { status: 500 });
    }
  }