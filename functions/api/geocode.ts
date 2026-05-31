interface Env {
  DB?: any;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request } = context;
  const url = new URL(request.url);
  const q = url.searchParams.get('q');
  
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  };

  if (!q) {
    return new Response(JSON.stringify({ error: 'Missing query' }), { status: 400, headers });
  }
  
  const osmUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&countrycodes=ng&limit=5`;
  
  try {
    const response = await fetch(osmUrl, {
      headers: {
        'User-Agent': 'HilfeIncidentRadar/1.0 (contact: support@hilfe.pages.dev)'
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      return new Response(JSON.stringify(data), { headers });
    } else {
      return new Response(JSON.stringify({ error: 'Failed to fetch suggestions' }), { status: response.status, headers });
    }
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers });
  }
};
