import { getDistance, clusterReports, formatTimeAgo } from './utils.ts';
import { Report, SearchAnchor } from './types';

// Declare Leaflet global namespace
declare const L: any;

// Extend Window interface for global map reference
interface CustomWindow extends Window {
  map: any;
}
declare const window: CustomWindow;

// Nigeria center coordinates
const NIGERIA_CENTER: [number, number] = [9.082, 8.6753];
const DEFAULT_ZOOM = 6;

let map: any;
let reportPinMarker: any = null;
let hotspotLayers: any[] = [];
let allReports: Report[] = [];
let searchAnchor: SearchAnchor | null = null;
let currentUploadedImageBase64: string | null = null;

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
  initMap();
  initEventListeners();
  loadReports();
});

// Initialize Leaflet Map
function initMap(): void {
  map = L.map('map', {
    zoomControl: false
  }).setView(NIGERIA_CENTER, DEFAULT_ZOOM);
  window.map = map; // Expose globally for browser test subagents & automated testing

  // Add zoom control on top-right
  L.control.zoom({ position: 'topright' }).addTo(map);

  // Use OpenStreetMap CartoDB Dark Matter tiles for premium dark mode
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    maxZoom: 20
  }).addTo(map);

  // Map click listener to drop/update report pin
  map.on('click', (e: any) => {
    updateReportPin(e.latlng.lat, e.latlng.lng);
  });
}

// Set up UI Event Listeners
function initEventListeners(): void {
  const triggerReportBtn = document.getElementById('trigger-report-btn') as HTMLButtonElement | null;
  const reportModal = document.getElementById('report-modal') as HTMLDivElement | null;
  const closeModalBtn = document.getElementById('close-modal-btn') as HTMLButtonElement | null;
  const useGpsBtn = document.getElementById('use-gps-btn') as HTMLButtonElement | null;
  const reportForm = document.getElementById('report-form') as HTMLFormElement | null;
  const filterTime = document.getElementById('filter-time') as HTMLSelectElement | null;
  const filterCategory = document.getElementById('filter-category') as HTMLSelectElement | null;
  const searchInput = document.getElementById('search-input') as HTMLInputElement | null;
  const searchBtn = document.getElementById('search-btn') as HTMLButtonElement | null;
  const gpsSearchBtn = document.getElementById('gps-search-btn') as HTMLButtonElement | null;
  const clearLocationBtn = document.getElementById('clear-location-btn') as HTMLButtonElement | null;

  // Modal controls
  if (triggerReportBtn && reportModal) {
    triggerReportBtn.addEventListener('click', () => {
      reportModal.classList.remove('hidden');
      const latInput = document.getElementById('report-lat') as HTMLInputElement | null;
      // If we don't have coords pinned yet, attempt GPS
      if (latInput && !latInput.value) {
        requestGPSLocation(false);
      }
    });
  }

  if (closeModalBtn && reportModal) {
    closeModalBtn.addEventListener('click', () => {
      reportModal.classList.add('hidden');
    });
  }

  // Close modal when clicking background overlay
  if (reportModal) {
    reportModal.addEventListener('click', (e) => {
      if (e.target === reportModal) {
        reportModal.classList.add('hidden');
      }
    });
  }

  // GPS geolocation button
  if (useGpsBtn) {
    useGpsBtn.addEventListener('click', () => {
      requestGPSLocation(true);
    });
  }

  // Image upload preview logic
  const reportImageInput = document.getElementById('report-image') as HTMLInputElement | null;
  const imagePreviewContainer = document.getElementById('image-preview-container') as HTMLDivElement | null;
  const imagePreview = document.getElementById('image-preview') as HTMLImageElement | null;
  const removeImageBtn = document.getElementById('remove-image-btn') as HTMLButtonElement | null;

  if (reportImageInput && imagePreviewContainer && imagePreview) {
    reportImageInput.addEventListener('change', (e) => {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];
      if (!file) return;

      // Limit file size to 2MB to keep Base64 payload reasonable
      if (file.size > 2 * 1024 * 1024) {
        alert('Image must be under 2MB.');
        reportImageInput.value = '';
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        currentUploadedImageBase64 = event.target?.result as string;
        imagePreview.src = currentUploadedImageBase64;
        imagePreviewContainer.classList.remove('hidden');
      };
      reader.readAsDataURL(file);
    });
  }

  if (removeImageBtn && reportImageInput && imagePreviewContainer && imagePreview) {
    removeImageBtn.addEventListener('click', () => {
      currentUploadedImageBase64 = null;
      reportImageInput.value = '';
      imagePreview.src = '';
      imagePreviewContainer.classList.add('hidden');
    });
  }

  // Form submission
  if (reportForm) {
    reportForm.addEventListener('submit', handleReportSubmit);
  }

  // Filter updates
  if (filterTime) {
    filterTime.addEventListener('change', filterAndRender);
  }
  if (filterCategory) {
    filterCategory.addEventListener('change', filterAndRender);
  }

  // Search logic
  if (searchBtn) {
    searchBtn.addEventListener('click', handleSearch);
  }
  if (searchInput) {
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        handleSearch();
        const suggestions = document.getElementById('search-suggestions');
        if (suggestions) suggestions.classList.add('hidden');
      }
    });
  }

  // Live autocomplete suggestions (debounced)
  let debounceTimer: ReturnType<typeof setTimeout>;
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      const query = searchInput.value.trim();
      if (query.length < 2) {
        const suggestions = document.getElementById('search-suggestions');
        if (suggestions) suggestions.classList.add('hidden');
        return;
      }
      debounceTimer = setTimeout(() => {
        fetchSuggestions(query);
      }, 300);
    });
  }

  // Hide suggestions when clicking outside search area
  document.addEventListener('click', (e) => {
    const searchSection = document.querySelector('.search-section');
    if (searchSection && !searchSection.contains(e.target as Node)) {
      const suggestions = document.getElementById('search-suggestions');
      if (suggestions) suggestions.classList.add('hidden');
    }
  });

  // GPS-based proximity search
  if (gpsSearchBtn) {
    gpsSearchBtn.addEventListener('click', () => {
      searchNearGPS();
    });
  }

  // Clear location anchor filter
  if (clearLocationBtn && searchInput) {
    clearLocationBtn.addEventListener('click', () => {
      console.log('Clearing location filter');
      searchAnchor = null;
      const banner = document.getElementById('active-location');
      if (banner) banner.classList.add('hidden');
      searchInput.value = '';
      filterAndRender();
    });
  }
}

// Request User Location
function requestGPSLocation(shouldPan: boolean = false): void {
  if (!navigator.geolocation) {
    alert('Geolocation is not supported by your browser.');
    return;
  }

  const coordsText = document.getElementById('coords-text');
  if (coordsText) coordsText.textContent = 'Locating...';

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const { latitude, longitude } = position.coords;
      updateReportPin(latitude, longitude);
      if (shouldPan) {
        map.setView([latitude, longitude], 12);
      }
    },
    (error) => {
      console.error('Error getting GPS coords:', error);
      if (coordsText) coordsText.textContent = 'Failed to get location. Click map to pin.';
    },
    { enableHighAccuracy: true, timeout: 5000 }
  );
}

// Drop/Move Report Pin on Map
function updateReportPin(lat: number, lng: number): void {
  const latInput = document.getElementById('report-lat') as HTMLInputElement | null;
  const lngInput = document.getElementById('report-lng') as HTMLInputElement | null;
  const coordsText = document.getElementById('coords-text');

  if (latInput) latInput.value = lat.toString();
  if (lngInput) lngInput.value = lng.toString();
  if (coordsText) coordsText.textContent = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;

  if (reportPinMarker) {
    reportPinMarker.setLatLng([lat, lng]);
  } else {
    const dangerIcon = L.divIcon({
      className: 'report-pin',
      html: `<span style="font-size: 24px;">📍</span>`,
      iconSize: [24, 24],
      iconAnchor: [12, 24]
    });
    reportPinMarker = L.marker([lat, lng], { icon: dangerIcon, draggable: true }).addTo(map);
    reportPinMarker.on('dragend', () => {
      const position = reportPinMarker.getLatLng();
      updateReportPin(position.lat, position.lng);
    });
  }
}

// Load incident reports from API (with local fallback)
async function loadReports(): Promise<void> {
  try {
    const response = await fetch('/api/reports');
    if (response.ok) {
      allReports = await response.json();
    } else {
      throw new Error('API failed');
    }
  } catch (error) {
    console.warn('API connection failed. Falling back to local storage reports.');
    const local = localStorage.getItem('hilfe_reports');
    if (local) {
      allReports = JSON.parse(local);
    } else {
      // Mock some initial data for showcase in Nigeria if empty
      allReports = getMockInitialData();
      localStorage.setItem('hilfe_reports', JSON.stringify(allReports));
    }
  }
  filterAndRender();
}

// Submit a new Incident Report
async function handleReportSubmit(e: Event): Promise<void> {
  e.preventDefault();

  const category = (document.getElementById('report-category') as unknown as HTMLSelectElement).value;
  const threat_level = (document.getElementById('report-threat-level') as unknown as HTMLSelectElement).value as Report['threat_level'];
  const title = (document.getElementById('report-title') as HTMLInputElement).value.trim();
  const details = (document.getElementById('report-details') as HTMLTextAreaElement).value.trim();
  const latInput = document.getElementById('report-lat') as HTMLInputElement | null;
  const lngInput = document.getElementById('report-lng') as HTMLInputElement | null;

  const lat = latInput ? parseFloat(latInput.value) : NaN;
  const lng = lngInput ? parseFloat(lngInput.value) : NaN;

  if (!category || !title || isNaN(lat) || isNaN(lng)) {
    alert('Please fill out all required fields and select a location.');
    return;
  }

  const newReport: Report = {
    id: 'rep_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
    category: category as Report['category'],
    threat_level,
    title,
    details,
    lat,
    lng,
    timestamp: new Date().toISOString(),
    image: currentUploadedImageBase64
  };

  try {
    const response = await fetch('/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newReport)
    });
    if (response.ok) {
      const saved = (await response.json()) as Report;
      allReports.unshift(saved);
    } else {
      throw new Error('POST failed');
    }
  } catch (error) {
    console.warn('Could not post report to API. Saving locally.');
    allReports.unshift(newReport);
    localStorage.setItem('hilfe_reports', JSON.stringify(allReports));
  }

  // Reset & close modal
  const form = document.getElementById('report-form') as HTMLFormElement | null;
  if (form) form.reset();
  currentUploadedImageBase64 = null;
  const imagePreviewContainer = document.getElementById('image-preview-container');
  if (imagePreviewContainer) {
    imagePreviewContainer.classList.add('hidden');
    const imagePreview = document.getElementById('image-preview') as HTMLImageElement | null;
    if (imagePreview) imagePreview.src = '';
  }
  const coordsText = document.getElementById('coords-text');
  if (coordsText) coordsText.textContent = 'Click on the map to pin location or use GPS';
  if (latInput) latInput.value = '';
  if (lngInput) lngInput.value = '';
  if (reportPinMarker) {
    map.removeLayer(reportPinMarker);
    reportPinMarker = null;
  }
  const modal = document.getElementById('report-modal');
  if (modal) modal.classList.add('hidden');

  filterAndRender();
}

// Filter reports and Render on Map and Feed
function filterAndRender(): void {
  const filterTime = document.getElementById('filter-time') as HTMLSelectElement | null;
  const filterCategory = document.getElementById('filter-category') as HTMLSelectElement | null;

  const selectedTimeframe = filterTime ? parseInt(filterTime.value) : 24; // in hours
  const selectedCategory = filterCategory ? filterCategory.value : 'all';

  const now = new Date();

  // Filter criteria
  let filtered = allReports.filter(report => {
    const reportTime = new Date(report.timestamp);
    const diffHours = (now.getTime() - reportTime.getTime()) / (1000 * 60 * 60);

    // Filter by timeframe
    if (diffHours > selectedTimeframe) return false;

    // Filter by category
    if (selectedCategory !== 'all' && report.category !== selectedCategory) return false;

    return true;
  });

  // Sort by location proximity if searchAnchor is active
  if (searchAnchor && searchAnchor.lat !== undefined && searchAnchor.lng !== undefined) {
    console.log(`Sorting ${filtered.length} reports by proximity to active location anchor:`, searchAnchor);
    filtered.sort((a, b) => {
      const distA = getDistance(a.lat, a.lng, searchAnchor!.lat, searchAnchor!.lng);
      const distB = getDistance(b.lat, b.lng, searchAnchor!.lat, searchAnchor!.lng);
      return distA - distB;
    });
  }

  renderMapHotspots(filtered);
  renderFeed(filtered);
}

// Render hotspots on map.
// Hotspot size logic: if multiple reports are within close proximity,
// they aggregate into one hotspot dot, and size increases.
function renderMapHotspots(reports: Report[]): void {
  // Clear existing layers
  hotspotLayers.forEach(layer => map.removeLayer(layer));
  hotspotLayers = [];

  const clusters = clusterReports(reports, 8); // group incidents within 8km using our shared utility

  // Place cluster dots on map
  clusters.forEach(cluster => {
    const count = cluster.reports.length;
    // Base size (e.g. 24px) + incremental size for multiple reports
    const size = Math.min(24 + (count - 1) * 8, 70); 

    // Determine cluster theme based on categories present
    let color = 'var(--primary)';
    const categories = cluster.reports.map(r => r.category);
    if (categories.includes('kidnapping')) {
      color = 'var(--color-kidnapping)';
    } else if (categories.includes('robbery')) {
      color = 'var(--color-robbery)';
    } else if (categories.includes('checkpoint')) {
      color = 'var(--color-checkpoint)';
    } else if (categories.includes('clash')) {
      color = 'var(--color-clash)';
    }

    const htmlContent = `
      <div class="hotspot-marker" style="width: ${size}px; height: ${size}px;">
        <div class="hotspot-pulse" style="background-color: ${color};"></div>
        <div class="hotspot-inner" style="background-color: ${color}; width: 100%; height: 100%;">
          ${count > 1 ? count : ''}
        </div>
      </div>
    `;

    const customIcon = L.divIcon({
      html: htmlContent,
      className: 'custom-cluster-icon',
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2]
    });

    const marker = L.marker([cluster.lat, cluster.lng], { icon: customIcon }).addTo(map);

    // Create details popup content
    let popupHtml = `<div style="font-family: var(--font-primary); color: #fff; max-width: 250px;">`;
    popupHtml += `<h4 style="margin-bottom: 8px; font-weight: 700; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 4px;">`;
    popupHtml += `${count} incident${count > 1 ? 's' : ''} here`;
    popupHtml += `</h4>`;
    popupHtml += `<div style="max-height: 180px; overflow-y: auto; padding-right: 4px;">`;

    cluster.reports.forEach((rep, idx) => {
      const dateStr = new Date(rep.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const severity = rep.threat_level || 'medium';
      const severityBadge = `<span class="card-badge badge-${severity}" style="display:inline-block; font-size:9px; margin-bottom:2px; margin-left:4px;">${severity.toUpperCase()}</span>`;
      const imageElement = rep.image ? `<div class="popup-image-container"><img src="${rep.image}" alt="Verification Image" onclick="window.open('${rep.image}', '_blank')"></div>` : '';
      
      popupHtml += `
        <div style="margin-bottom: ${idx === cluster.reports.length - 1 ? '0' : '10px'}">
          <span class="card-badge badge-${rep.category}" style="display:inline-block; font-size:9px; margin-bottom:2px;">${rep.category.toUpperCase()}</span>
          ${severityBadge}
          <div style="font-size:12px; font-weight: 600;">${rep.title}</div>
          <div style="font-size:10px; color: var(--color-text-secondary); margin-bottom: 2px;">${dateStr}</div>
          ${rep.details ? `<div style="font-size:10px; color: var(--color-text-muted); line-height: 1.3; margin-bottom: 4px;">${rep.details}</div>` : ''}
          ${imageElement}
        </div>
      `;
    });
    popupHtml += `</div></div>`;

    marker.bindPopup(popupHtml);
    hotspotLayers.push(marker);
  });
}

// Render incident feed in sidebar
function renderFeed(reports: Report[]): void {
  const feedContainer = document.getElementById('incident-feed');
  if (!feedContainer) return;
  feedContainer.innerHTML = '';

  if (reports.length === 0) {
    feedContainer.innerHTML = '<div class="feed-placeholder">No incidents reported in this timeframe.</div>';
    return;
  }

  reports.forEach(report => {
    const card = document.createElement('div');
    card.className = 'incident-card';
    
    const timeAgo = formatTimeAgo(new Date(report.timestamp));

    let distanceText = '';
    if (searchAnchor && searchAnchor.lat !== undefined && searchAnchor.lng !== undefined) {
      const dist = getDistance(report.lat, report.lng, searchAnchor.lat, searchAnchor.lng);
      distanceText = `<span class="card-distance">${dist.toFixed(1)} km away</span>`;
    }

    const severity = report.threat_level || 'medium';
    const severityBadge = `<span class="card-badge badge-${severity}">${severity}</span>`;
    const cardImage = report.image ? `<div class="card-image-preview"><img src="${report.image}" alt="Attached verification image"></div>` : '';

    card.innerHTML = `
      <div class="card-header">
        <div>
          <span class="card-badge badge-${report.category}">${report.category}</span>
          ${severityBadge}
          ${distanceText}
        </div>
        <span class="card-time">${timeAgo}</span>
      </div>
      <div class="card-title">${report.title}</div>
      ${report.details ? `<div class="card-details">${report.details}</div>` : ''}
      ${cardImage}
    `;

    // Click card to zoom to incident
    card.addEventListener('click', () => {
      map.setView([report.lat, report.lng], 13);
      // Wait for pan animation then show marker popup
      setTimeout(() => {
        // Find marker closest to this location and open its popup
        hotspotLayers.forEach(layer => {
          const latlng = layer.getLatLng();
          const dist = getDistance(report.lat, report.lng, latlng.lat, latlng.lng);
          if (dist < 8) {
            layer.openPopup();
          }
        });
      }, 300);
    });

    feedContainer.appendChild(card);
  });
}

// Search Place Geocoding via Nominatim
async function handleSearch(): Promise<void> {
  const searchInput = document.getElementById('search-input') as HTMLInputElement | null;
  if (!searchInput) return;
  
  const query = searchInput.value.trim();
  if (!query) return;

  const searchBtn = document.getElementById('search-btn');
  if (!searchBtn) return;
  
  const origBtnContent = searchBtn.textContent;
  searchBtn.textContent = '⏳';

  try {
    let lat: number = NaN;
    let lon: number = NaN;
    let found = false;

    // Phase 1: Try local backend proxy
    try {
      const response = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
      if (response.ok) {
        const data = (await response.json()) as any[];
        if (data && data.length > 0) {
          lat = parseFloat(data[0].lat);
          lon = parseFloat(data[0].lon);
          found = true;
        }
      }
    } catch (e) {
      console.warn('Backend geocode proxy failed, trying direct OpenStreetMap...', e);
    }

    // Phase 2: Fallback to direct OSM Nominatim query (handles local dev fallback)
    if (!found) {
      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=ng&limit=1`);
        if (response.ok) {
          const data = (await response.json()) as any[];
          if (data && data.length > 0) {
            lat = parseFloat(data[0].lat);
            lon = parseFloat(data[0].lon);
            found = true;
          }
        }
      } catch (e) {
        console.warn('Direct OSM query failed, checking offline dictionary...', e);
      }
    }

    // Phase 3: Predefined fallback coordinate dictionary for major Nigerian locations
    if (!found) {
      const dictionary: Record<string, { lat: number, lon: number }> = {
        'abule egba': { lat: 6.6436, lon: 3.2842 },
        'lagos': { lat: 6.5244, lon: 3.3792 },
        'ikeja': { lat: 6.6018, lon: 3.3515 },
        'abuja': { lat: 9.0765, lon: 7.3986 },
        'kaduna': { lat: 10.5105, lon: 7.4165 },
        'suleja': { lat: 9.1806, lon: 7.1794 },
        'gwagwalada': { lat: 8.9515, lon: 7.0784 },
        'benin city': { lat: 6.3350, lon: 5.6269 },
        'ibadan': { lat: 7.3775, lon: 3.9470 },
        'kano': { lat: 12.0022, lon: 8.5920 },
        'port harcourt': { lat: 4.8156, lon: 7.0498 }
      };

      const normalizedQuery = query.toLowerCase().trim();
      const match = Object.keys(dictionary).find(key => normalizedQuery.includes(key));
      
      if (match) {
        lat = dictionary[match].lat;
        lon = dictionary[match].lon;
        found = true;
      }
    }

    if (found && !isNaN(lat) && !isNaN(lon)) {
      console.log('Search matched coordinates:', query, lat, lon);
      searchAnchor = { lat, lng: lon, name: query };
      updateActiveLocationBanner(query);

      map.setView([lat, lon], 13);
      // Place a visual marker or ping to show search result
      L.popup()
        .setLatLng([lat, lon])
        .setContent(`<div style="color:#fff; font-family:var(--font-primary); font-size:12px;">📍 Search result: <b>${query}</b></div>`)
        .openOn(map);

      filterAndRender();
    } else {
      alert('Place not found. Try searching with city/state (e.g. Abuja, Lagos, or Kaduna).');
    }
  } catch (error) {
    console.error('Search error:', error);
    alert('Search failed. Please try again.');
  } finally {
    searchBtn.textContent = origBtnContent;
  }
}

// Fetch autocomplete suggestions with fallback support
async function fetchSuggestions(query: string): Promise<void> {
  try {
    let results: any[] = [];
    let found = false;

    // Phase 1: Try geocode proxy endpoint
    try {
      const response = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
      if (response.ok) {
        results = await response.json();
        found = true;
      }
    } catch (e) {
      console.warn('Autocomplete geocode proxy failed, trying direct OSM Nominatim...', e);
    }

    // Phase 2: Fallback to direct OSM query
    if (!found) {
      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=ng&limit=5`);
        if (response.ok) {
          results = await response.json();
          found = true;
        }
      } catch (e) {
        console.warn('Direct OSM query failed, using offline fallback...', e);
      }
    }

    // Phase 3: Offline dictionary mapping matching queries
    const dictionary: Record<string, { lat: number, lon: number, display_name: string }> = {
      'abule egba': { lat: 6.6436, lon: 3.2842, display_name: 'Abule Egba, Alimosho, Lagos, Nigeria' },
      'lagos': { lat: 6.5244, lon: 3.3792, display_name: 'Lagos, Nigeria' },
      'ikeja': { lat: 6.6018, lon: 3.3515, display_name: 'Ikeja, Lagos, Nigeria' },
      'abuja': { lat: 9.0765, lon: 7.3986, display_name: 'Abuja, Federal Capital Territory, Nigeria' },
      'kaduna': { lat: 10.5105, lon: 7.4165, display_name: 'Kaduna, Nigeria' },
      'suleja': { lat: 9.1806, lon: 7.1794, display_name: 'Suleja, Niger State, Nigeria' },
      'gwagwalada': { lat: 8.9515, lon: 7.0784, display_name: 'Gwagwalada, FCT, Nigeria' },
      'benin city': { lat: 6.3350, lon: 5.6269, display_name: 'Benin City, Edo State, Nigeria' },
      'ibadan': { lat: 7.3775, lon: 3.9470, display_name: 'Ibadan, Oyo State, Nigeria' },
      'kano': { lat: 12.0022, lon: 8.5920, display_name: 'Kano, Nigeria' },
      'port harcourt': { lat: 4.8156, lon: 7.0498, display_name: 'Port Harcourt, Rivers State, Nigeria' }
    };

    const normalizedQuery = query.toLowerCase().trim();
    const dictionaryMatches = Object.keys(dictionary)
      .filter(key => key.includes(normalizedQuery))
      .map(key => ({
        display_name: dictionary[key].display_name,
        lat: dictionary[key].lat.toString(),
        lon: dictionary[key].lon.toString()
      }));

    if (results.length === 0) {
      results = dictionaryMatches;
    }

    renderSuggestions(results);
  } catch (error) {
    console.error('Suggestions fetch error:', error);
  }
}

// Render search suggestions inside the drop-down list panel
function renderSuggestions(results: any[]): void {
  const suggestionsBox = document.getElementById('search-suggestions');
  if (!suggestionsBox) return;

  suggestionsBox.innerHTML = '';

  if (!results || results.length === 0) {
    suggestionsBox.classList.add('hidden');
    return;
  }

  suggestionsBox.classList.remove('hidden');

  results.forEach(item => {
    const div = document.createElement('div');
    div.className = 'suggestion-item';
    div.textContent = item.display_name;

    div.addEventListener('click', () => {
      const searchInput = document.getElementById('search-input') as HTMLInputElement | null;
      if (searchInput) searchInput.value = item.display_name;
      suggestionsBox.classList.add('hidden');

      const lat = parseFloat(item.lat);
      const lon = parseFloat(item.lon);
      if (!isNaN(lat) && !isNaN(lon)) {
        console.log('Suggestion selected:', item.display_name, lat, lon);
        searchAnchor = { lat, lng: lon, name: item.display_name };
        updateActiveLocationBanner(item.display_name);

        map.setView([lat, lon], 13);
        L.popup()
          .setLatLng([lat, lon])
          .setContent(`<div style="color:#fff; font-family:var(--font-primary); font-size:12px;">📍 Panned to: <b>${item.display_name}</b></div>`)
          .openOn(map);

        filterAndRender();
      }
    });

    suggestionsBox.appendChild(div);
  });
}

// Mock initial data centered around main hot security zones in Nigeria (e.g. Abuja-Kaduna highway, Lokoja, etc.)
function getMockInitialData(): Report[] {
  const now = new Date();
  
  const getPastTime = (hoursAgo: number): string => {
    const d = new Date(now);
    d.setMinutes(d.getMinutes() - (hoursAgo * 60 + Math.random() * 30));
    return d.toISOString();
  };

  return [
    {
      id: 'mock_1',
      category: 'kidnapping',
      title: 'Suspicious vehicle attempt on Abuja-Kaduna Highway',
      details: 'Unidentified gun-wielding men in a dark SUV tried blocking traffic near Rijana. Security forces engaged them, but caution is advised.',
      lat: 9.9482,
      lng: 7.3753,
      timestamp: getPastTime(1.5),
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
      timestamp: getPastTime(0.5),
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
      timestamp: getPastTime(0.2),
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
      timestamp: getPastTime(3),
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
      timestamp: getPastTime(4.5),
      threat_level: 'low',
      image: null
    }
  ];
}

// Search near user GPS location
function searchNearGPS(): void {
  if (!navigator.geolocation) {
    alert('Geolocation is not supported by your browser.');
    return;
  }

  const gpsBtn = document.getElementById('gps-search-btn');
  if (!gpsBtn) return;
  
  const origText = gpsBtn.textContent;
  gpsBtn.textContent = '⏳';

  navigator.geolocation.getCurrentPosition(
    (position) => {
      gpsBtn.textContent = origText;
      const { latitude, longitude } = position.coords;
      console.log('GPS search query coordinates:', latitude, longitude);
      searchAnchor = { lat: latitude, lng: longitude, name: 'My Location' };
      updateActiveLocationBanner('My Location');
      
      map.setView([latitude, longitude], 13);
      L.popup()
        .setLatLng([latitude, longitude])
        .setContent(`<div style="color:#fff; font-family:var(--font-primary); font-size:12px;">📍 Search result: <b>My Location</b></div>`)
        .openOn(map);

      filterAndRender();
    },
    (error) => {
      gpsBtn.textContent = origText;
      console.error('Error getting GPS coords for search:', error);
      alert('Failed to get your GPS location. Please ensure location services are enabled.');
    },
    { enableHighAccuracy: true, timeout: 5000 }
  );
}

// Update Active Location Banner display
function updateActiveLocationBanner(name: string): void {
  const activeLocationDiv = document.getElementById('active-location');
  const locationNameSpan = document.getElementById('location-name');
  if (activeLocationDiv && locationNameSpan) {
    locationNameSpan.textContent = name;
    activeLocationDiv.classList.remove('hidden');
  }
}
