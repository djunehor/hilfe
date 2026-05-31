import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('UI Elements and Structure', () => {
  beforeEach(() => {
    // Load index.html into the jsdom environment
    const htmlPath = resolve(__dirname, '../index.html');
    const html = readFileSync(htmlPath, 'utf8');
    document.body.innerHTML = html;
  });

  it('renders the header and main layout', () => {
    const title = document.querySelector('h1');
    expect(title).toBeDefined();
    expect(title.textContent).toBe('Hilfe');

    const sidebar = document.getElementById('sidebar');
    expect(sidebar).not.toBeNull();

    const mapContainer = document.getElementById('map');
    expect(mapContainer).not.toBeNull();
  });

  it('contains the filter elements with correct options', () => {
    const filterTime = document.getElementById('filter-time');
    expect(filterTime).not.toBeNull();
    expect(filterTime.children).toHaveLength(4);

    const filterCategory = document.getElementById('filter-category');
    expect(filterCategory).not.toBeNull();
    expect(filterCategory.children).toHaveLength(6);
  });

  it('has a hidden report modal by default', () => {
    const modal = document.getElementById('report-modal');
    expect(modal).not.toBeNull();
    expect(modal.classList.contains('hidden')).toBe(true);
  });

  it('modal contains all required fields for incident reporting', () => {
    const categorySelect = document.getElementById('report-category');
    expect(categorySelect).not.toBeNull();
    expect(categorySelect.required).toBe(true);

    const titleInput = document.getElementById('report-title');
    expect(titleInput).not.toBeNull();
    expect(titleInput.required).toBe(true);

    const detailsTextarea = document.getElementById('report-details');
    expect(detailsTextarea).not.toBeNull();

    const latInput = document.getElementById('report-lat');
    const lngInput = document.getElementById('report-lng');
    expect(latInput).not.toBeNull();
    expect(lngInput).not.toBeNull();
    expect(latInput.required).toBe(true);
    expect(lngInput.required).toBe(true);
  });

  it('contains the new location search and active location elements', () => {
    const gpsSearchBtn = document.getElementById('gps-search-btn');
    expect(gpsSearchBtn).not.toBeNull();

    const activeLocation = document.getElementById('active-location');
    expect(activeLocation).not.toBeNull();
    expect(activeLocation.classList.contains('hidden')).toBe(true);

    const clearLocationBtn = document.getElementById('clear-location-btn');
    expect(clearLocationBtn).not.toBeNull();
  });

  it('contains threat severity selector and image upload element in report form', () => {
    const threatLevelSelect = document.getElementById('report-threat-level');
    expect(threatLevelSelect).not.toBeNull();
    expect(threatLevelSelect.required).toBe(true);
    expect(threatLevelSelect.children).toHaveLength(4); // low, medium, high, critical

    const fileInput = document.getElementById('report-image');
    expect(fileInput).not.toBeNull();
    expect(fileInput.getAttribute('accept')).toBe('image/*');

    const imagePreviewContainer = document.getElementById('image-preview-container');
    expect(imagePreviewContainer).not.toBeNull();
    expect(imagePreviewContainer.classList.contains('hidden')).toBe(true);
  });
});
