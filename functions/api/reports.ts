import { Report } from '../../src/types';

// In-memory store for worker instances (graceful fallback if DB is not configured)
let localMemoryReports: Report[] | null = null;

function getInitialMockReports(): Report[] {
  const now = Date.now();
  return [
    {
      id: 'mock_1',
      category: 'kidnapping',
      title: 'Suspicious vehicle attempt on Abuja-Kaduna Highway',
      details: 'Unidentified gun-wielding men in a dark SUV tried blocking traffic near Rijana. Security forces engaged them, but caution is advised.',
      lat: 9.9482,
      lng: 7.3753,
      timestamp: new Date(now - 1.5 * 60 * 60 * 1000).toISOString(),
      threat_level: 'critical',
      image: null
    },
    {
      id: 'mock_2',
      category: 'checkpoint',
      title: 'Illegal military roadblock near Suleja exit',
      details: 'Armed individuals in mismatched uniforms demanding cash checkpoints. Multiple motorists turned back.',
      lat: 9.1820,
      lng: 7.1753,
      timestamp: new Date(now - 0.5 * 60 * 60 * 1000).toISOString(),
      threat_level: 'high',
      image: null
    },
    {
      id: 'mock_3',
      category: 'checkpoint',
      title: 'Suspicious roadblock reported by drivers',
      details: 'Second report of illegal roadblock Suleja exit within 1 hour. Drivers advised to bypass route.',
      lat: 9.1840,
      lng: 7.1720,
      timestamp: new Date(now - 0.2 * 60 * 60 * 1000).toISOString(),
      threat_level: 'medium',
      image: null
    },
    {
      id: 'mock_4',
      category: 'robbery',
      title: 'Armed attack near Gwagwalada Road',
      details: 'Active robbery incident targeting commercial vehicles. Stay clear.',
      lat: 8.9482,
      lng: 7.0753,
      timestamp: new Date(now - 3 * 60 * 60 * 1000).toISOString(),
      threat_level: 'high',
      image: null
    },
    {
      id: 'mock_5',
      category: 'clash',
      title: 'Protest & road blockages in Benin City bypass',
      details: 'High tension bypass roadblock. Heavy smoke and debris blocking roads.',
      lat: 6.3350,
      lng: 5.6269,
      timestamp: new Date(now - 4.5 * 60 * 60 * 1000).toISOString(),
      threat_level: 'low',
      image: null
    }
  ];
}

interface Env {
  DB?: any;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env } = context;

  // Initialize local memory store dynamically on first request
  if (!localMemoryReports) {
    localMemoryReports = getInitialMockReports();
  }

  // Standard CORS headers
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  };

  // If Cloudflare D1 Database is bound as DB
  if (env.DB) {
    try {
      // Ensure table exists
      await env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS reports (
          id TEXT PRIMARY KEY,
          category TEXT,
          title TEXT,
          details TEXT,
          lat REAL,
          lng REAL,
          timestamp TEXT,
          threat_level TEXT,
          image TEXT
        )
      `).run();

      // Safe migrations for existing databases
      try {
        await env.DB.prepare("ALTER TABLE reports ADD COLUMN threat_level TEXT").run();
      } catch (e) {}
      try {
        await env.DB.prepare("ALTER TABLE reports ADD COLUMN image TEXT").run();
      } catch (e) {}

      const { results } = await env.DB.prepare("SELECT * FROM reports ORDER BY timestamp DESC").all();
      
      // If DB is empty, seed it with mock data
      if (results.length === 0) {
        for (const rep of localMemoryReports) {
          await env.DB.prepare(
            "INSERT INTO reports (id, category, title, details, lat, lng, timestamp, threat_level, image) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
          ).bind(rep.id, rep.category, rep.title, rep.details, rep.lat, rep.lng, rep.timestamp, rep.threat_level || 'medium', rep.image || null).run();
        }
        return new Response(JSON.stringify(localMemoryReports), { headers });
      }

      return new Response(JSON.stringify(results), { headers });
    } catch (err: any) {
      return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
    }
  }

  // Fallback to in-memory store
  return new Response(JSON.stringify(localMemoryReports), { headers });
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  };

  try {
    const report = (await request.json()) as Partial<Report>;

    // Basic validation
    if (!report.category || !report.title || !report.lat || !report.lng) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400, headers });
    }

    const newReport: Report = {
      id: report.id || 'rep_' + Date.now(),
      category: report.category,
      title: report.title,
      details: report.details || '',
      lat: parseFloat(report.lat as any),
      lng: parseFloat(report.lng as any),
      timestamp: report.timestamp || new Date().toISOString(),
      threat_level: report.threat_level || 'medium',
      image: report.image || null
    };

    // If Cloudflare D1 Database is bound
    if (env.DB) {
      await env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS reports (
          id TEXT PRIMARY KEY,
          category TEXT,
          title TEXT,
          details TEXT,
          lat REAL,
          lng REAL,
          timestamp TEXT,
          threat_level TEXT,
          image TEXT
        )
      `).run();

      // Safe migrations
      try {
        await env.DB.prepare("ALTER TABLE reports ADD COLUMN threat_level TEXT").run();
      } catch (e) {}
      try {
        await env.DB.prepare("ALTER TABLE reports ADD COLUMN image TEXT").run();
      } catch (e) {}

      await env.DB.prepare(
        "INSERT INTO reports (id, category, title, details, lat, lng, timestamp, threat_level, image) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
      ).bind(newReport.id, newReport.category, newReport.title, newReport.details, newReport.lat, newReport.lng, newReport.timestamp, newReport.threat_level, newReport.image).run();
    } else {
      // Fallback: save to in-memory list
      if (!localMemoryReports) {
        localMemoryReports = getInitialMockReports();
      }
      localMemoryReports.unshift(newReport);
    }

    return new Response(JSON.stringify(newReport), { status: 201, headers });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
  }
};

// Handle options preflight
export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
};
