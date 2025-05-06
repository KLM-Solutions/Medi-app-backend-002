import { NextResponse } from 'next/server';

// Use the environment variable instead
const FDA_API_KEY = process.env.FDA_API_KEY;

export async function GET(request: Request) {
  try {
    if (!FDA_API_KEY) {
      return NextResponse.json({
        success: false,
        message: 'FDA API key is not configured',
        suggestions: []
      }, { status: 500 });
    }

    // Get the search query
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');

    if (!query) {
      return NextResponse.json({
        success: false,
        message: 'Please provide a search query parameter (q)',
        suggestions: []
      });
    }

    // Construct the FDA API URL
    const fdaUrl = `https://api.fda.gov/drug/label.json?api_key=${FDA_API_KEY}&search=(openfda.brand_name:${encodeURIComponent(query)}*)+OR+(openfda.generic_name:${encodeURIComponent(query)}*)&limit=20`;

    // Make the request to FDA API
    const response = await fetch(fdaUrl);
    const data = await response.json();

    // Check if we have results
    if (!data.results || !Array.isArray(data.results)) {
      return NextResponse.json({
        success: false,
        message: 'No results found',
        suggestions: []
      });
    }

    // Process the results
    const suggestions = data.results
      .filter((result: any) => result.openfda)
      .map((result: any) => {
        const brandName = result.openfda?.brand_name?.[0] || '';
        const genericName = result.openfda?.generic_name?.[0] || '';
        const strength = result.active_ingredient?.[0] || '';

        return {
          name: brandName || genericName,
          strength: strength
        };
      })
      .filter((suggestion: any) => 
        suggestion.name && 
        suggestion.name.toLowerCase().includes(query.toLowerCase())
      );

    // Return the processed results
    return NextResponse.json({
      success: true,
      query,
      total: suggestions.length,
      suggestions
    });

  } catch (error) {
    console.error('Error in FDA API request:', error);
    
    // Return a proper error response
    return NextResponse.json({
      success: false,
      message: 'Error fetching medication data',
      error: error instanceof Error ? error.message : 'Unknown error',
      suggestions: []
    }, { status: 500 });
  }
}

export async function OPTIONS(request: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Max-Age': '86400'
    }
  });
}

