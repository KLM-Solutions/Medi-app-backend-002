// app/api/tts/route.ts
import { ElevenLabsClient } from 'elevenlabs';

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  try {
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  } catch (error) {
    console.error('Error converting stream to buffer:', error);
    throw error;
  }
}

export async function POST(req: Request) {
  try {
    if (!process.env.ELEVENLABS_API_KEY) {
      throw new Error('ELEVENLABS_API_KEY is not configured');
    }

    const elevenLabs = new ElevenLabsClient({
      apiKey: process.env.ELEVENLABS_API_KEY,
    });

    const { text } = await req.json();
    const audioStream = await elevenLabs.textToSpeech.convertAsStream(
      "JBFqnCBsd6RMkjVDRZzb",
      {
        text,
        model_id: "eleven_multilingual_v2",
      }
    );
    
    const buffer = await streamToBuffer(audioStream);
    
    return new Response(buffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
      },
    });
  } catch (error) {
    console.error('TTS Error:', error);
    return new Response(JSON.stringify({ error: 'TTS Generation Failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
