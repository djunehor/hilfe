export interface Report {
  id: string;
  category: 'kidnapping' | 'checkpoint' | 'robbery' | 'clash' | 'other';
  threat_level: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  details?: string;
  lat: number;
  lng: number;
  timestamp: string;
  image?: string | null;
}

export interface SearchAnchor {
  lat: number;
  lng: number;
  name: string;
}

export interface HotspotCluster {
  lat: number;
  lng: number;
  reports: Report[];
}
