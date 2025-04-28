// app/api/memory/route.ts
import { NextResponse } from 'next/server';
import { OpenAI } from 'openai';
import { Pool } from 'pg';

// Initialize OpenAI client with explicit API key
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY
});

// Initialize PostgreSQL connection pool
const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:MteivdRH0V2I@ep-holy-mouse-a5n9cbo9.us-east-2.aws.neon.tech/Memory?sslmode=require'
});

// Function to get embedding from OpenAI
async function getEmbedding(text: string) {
  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-ada-002",
      input: text,
    });
    return response.data[0].embedding;
  } catch (error) {
    console.error('Error getting embedding:', error);
    throw error;
  }
}

// Function to generate summary using OpenAI
async function generateSummary(text: string) {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant that creates concise summaries."
        },
        {
          role: "user",
          content: `Summarize this question: "${text}"`
        }
      ]
    });
    return response.choices[0].message.content || text;
  } catch (error) {
    console.error('Error generating summary:', error);
    throw error;
  }
}

// Initialize database
async function initializeDatabase() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE EXTENSION IF NOT EXISTS vector;
      
      CREATE TABLE IF NOT EXISTS chat_memory (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        question TEXT NOT NULL,
        question_summary TEXT NOT NULL,
        question_embedding vector(1536),
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
  } catch (error) {
    console.error('Error initializing database:', error);
  } finally {
    client.release();
  }
}

// Initialize database on module load
initializeDatabase().catch(console.error);

export async function POST(req: Request) {
  try {
    const { question } = await req.json();
    
    if (!question) {
      return NextResponse.json(
        { status: 'error', message: 'Question is required' },
        { status: 400 }
      );
    }

    // Generate summary and embedding
    const [summary, embedding] = await Promise.all([
      generateSummary(question),
      getEmbedding(question)
    ]);

    // Store in database
    const client = await pool.connect();
    try {
      await client.query(
        `INSERT INTO chat_memory (question, question_summary, question_embedding)
         VALUES ($1, $2, $3)`,
        [question, summary, embedding]
      );

      return NextResponse.json({
        status: 'success',
        summary,
        message: 'Memory stored successfully'
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error in POST /api/memory:', error);
    return NextResponse.json(
      { status: 'error', message: 'Failed to store memory' },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('query');

    if (!query) {
      return NextResponse.json(
        { status: 'error', message: 'Query parameter is required' },
        { status: 400 }
      );
    }

    const embedding = await getEmbedding(query);
    
    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT id, question, question_summary, timestamp,
         1 - (question_embedding <=> $1) as similarity
         FROM chat_memory
         WHERE 1 - (question_embedding <=> $1) > 0.8
         ORDER BY question_embedding <=> $1
         LIMIT 5`,
        [embedding]
      );

      return NextResponse.json({
        status: 'success',
        memories: result.rows
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error in GET /api/memory:', error);
    return NextResponse.json(
      { status: 'error', message: 'Failed to retrieve memories' },
      { status: 500 }
    );
  }
}