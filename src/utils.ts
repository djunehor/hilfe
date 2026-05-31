import { Report, HotspotCluster } from './types';

/**
 * Calculate the great-circle distance between two points on the Earth's surface
 * using the Haversine formula.
 */
export function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function deg2rad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Groups raw reports into geographical clusters.
 * If reports are within CLUSTER_DISTANCE_KM, they form a single cluster hotspot.
 */
export function clusterReports(reports: Report[], maxDistanceKm: number = 8): HotspotCluster[] {
  const clusters: HotspotCluster[] = [];

  reports.forEach(report => {
    let added = false;
    for (const cluster of clusters) {
      const distance = getDistance(report.lat, report.lng, cluster.lat, cluster.lng);
      if (distance <= maxDistanceKm) {
        cluster.reports.push(report);
        // Recalculate average center
        cluster.lat = (cluster.lat * (cluster.reports.length - 1) + report.lat) / cluster.reports.length;
        cluster.lng = (cluster.lng * (cluster.reports.length - 1) + report.lng) / cluster.reports.length;
        added = true;
        break;
      }
    }
    if (!added) {
      clusters.push({
        lat: report.lat,
        lng: report.lng,
        reports: [report]
      });
    }
  });

  return clusters;
}

/**
 * Formats standard ISO timestamp into user-friendly time ago strings
 */
export function formatTimeAgo(dateString: string | Date, now: Date = new Date()): string {
  const date = new Date(dateString);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
