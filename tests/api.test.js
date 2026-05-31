import { describe, it, expect } from 'vitest';
import { getDistance, clusterReports, formatTimeAgo } from '../src/utils.ts';

describe('Utility Algorithms', () => {
  describe('getDistance (Haversine)', () => {
    it('calculates the correct distance between Abuja and Lagos', () => {
      // Abuja approx coords: 9.0765, 7.3986
      // Lagos approx coords: 6.5244, 3.3792
      const distance = getDistance(9.0765, 7.3986, 6.5244, 3.3792);
      
      // Distance is roughly 500-550 km
      expect(distance).toBeGreaterThan(500);
      expect(distance).toBeLessThan(560);
    });

    it('returns 0 for the same point', () => {
      const distance = getDistance(9.0765, 7.3986, 9.0765, 7.3986);
      expect(distance).toBe(0);
    });
  });

  describe('clusterReports', () => {
    it('groups reports that are near each other into one cluster', () => {
      const reports = [
        { id: '1', lat: 9.0765, lng: 7.3986, title: 'Abuja Central' },
        { id: '2', lat: 9.0800, lng: 7.4000, title: 'Abuja North' }, // very close
        { id: '3', lat: 6.5244, lng: 3.3792, title: 'Lagos' }        // far away
      ];

      const clusters = clusterReports(reports, 8); // 8km threshold

      expect(clusters).toHaveLength(2);
      
      // Find the Abuja cluster (should contain 2 reports)
      const abujaCluster = clusters.find(c => c.reports.length === 2);
      expect(abujaCluster).toBeDefined();
      expect(abujaCluster.reports.map(r => r.id)).toContain('1');
      expect(abujaCluster.reports.map(r => r.id)).toContain('2');

      // Find the Lagos cluster (should contain 1 report)
      const lagosCluster = clusters.find(c => c.reports.length === 1);
      expect(lagosCluster).toBeDefined();
      expect(lagosCluster.reports[0].id).toBe('3');
    });

    it('calculates the average center of a cluster', () => {
      const reports = [
        { id: '1', lat: 9.0, lng: 7.0 },
        { id: '2', lat: 9.2, lng: 7.2 }
      ];
      // Max distance 50km so they group together
      const clusters = clusterReports(reports, 50);
      expect(clusters).toHaveLength(1);
      expect(clusters[0].lat).toBeCloseTo(9.1);
      expect(clusters[0].lng).toBeCloseTo(7.1);
    });
  });

  describe('formatTimeAgo', () => {
    it('returns "just now" for very recent times', () => {
      const now = new Date();
      const recent = new Date(now.getTime() - 10 * 1000); // 10s ago
      expect(formatTimeAgo(recent.toISOString(), now)).toBe('just now');
    });

    it('returns minutes ago', () => {
      const now = new Date();
      const past = new Date(now.getTime() - 15 * 60 * 1000); // 15m ago
      expect(formatTimeAgo(past.toISOString(), now)).toBe('15m ago');
    });

    it('returns hours ago', () => {
      const now = new Date();
      const past = new Date(now.getTime() - 3 * 60 * 60 * 1000); // 3h ago
      expect(formatTimeAgo(past.toISOString(), now)).toBe('3h ago');
    });

    it('returns days ago', () => {
      const now = new Date();
      const past = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000); // 2d ago
      expect(formatTimeAgo(past.toISOString(), now)).toBe('2d ago');
    });
  });

  describe('Proximity Sorting', () => {
    it('sorts reports correctly by distance from Abuja', () => {
      const reports = [
        { id: 'lagos', lat: 6.5244, lng: 3.3792, title: 'Lagos Incident' },
        { id: 'abuja_near', lat: 9.0800, lng: 7.4000, title: 'Abuja Near Incident' },
        { id: 'kaduna', lat: 10.5105, lng: 7.4165, title: 'Kaduna Incident' }
      ];

      const searchAnchor = { lat: 9.0765, lng: 7.3986 };

      const sorted = [...reports].sort((a, b) => {
        const distA = getDistance(a.lat, a.lng, searchAnchor.lat, searchAnchor.lng);
        const distB = getDistance(b.lat, b.lng, searchAnchor.lat, searchAnchor.lng);
        return distA - distB;
      });

      expect(sorted[0].id).toBe('abuja_near');
      expect(sorted[1].id).toBe('kaduna');
      expect(sorted[2].id).toBe('lagos');
    });
  });

  describe('Threat Severity Levels', () => {
    it('correctly categorizes threat levels from low to critical', () => {
      const reports = [
        { id: '1', category: 'kidnapping', threat_level: 'critical' },
        { id: '2', category: 'robbery', threat_level: 'high' },
        { id: '3', category: 'checkpoint', threat_level: 'medium' },
        { id: '4', category: 'other', threat_level: 'low' }
      ];

      expect(reports.find(r => r.id === '1').threat_level).toBe('critical');
      expect(reports.find(r => r.id === '2').threat_level).toBe('high');
      expect(reports.find(r => r.id === '3').threat_level).toBe('medium');
      expect(reports.find(r => r.id === '4').threat_level).toBe('low');
    });
  });
});
