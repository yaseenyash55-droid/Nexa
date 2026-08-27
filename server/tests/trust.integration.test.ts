import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import * as cheerio from 'cheerio';

describe('Trust & Discoverability - Sub-Prompt 3', () => {
  it('1. TRUST ANCHOR PAGES - /about passes 500-char check', async () => {
    const res = await request(app).get('/about');
    expect(res.status).toBe(200);
    
    // Parse the HTML to extract text content
    const $ = cheerio.load(res.text);
    const textContent = $('#root').text();
    
    expect(textContent.length).toBeGreaterThanOrEqual(500);
    expect(textContent).toContain('[NEEDS REAL COMPANY INFO]');
  });

  it('1. TRUST ANCHOR PAGES - /contact passes 500-char check', async () => {
    const res = await request(app).get('/contact');
    expect(res.status).toBe(200);
    
    const $ = cheerio.load(res.text);
    const textContent = $('#root').text();
    
    expect(textContent.length).toBeGreaterThanOrEqual(500);
    expect(textContent).toContain('[NEEDS REAL COMPANY INFO]');
  });

  it('1. TRUST ANCHOR PAGES - /privacy passes 500-char check', async () => {
    const res = await request(app).get('/privacy');
    expect(res.status).toBe(200);
    
    const $ = cheerio.load(res.text);
    const textContent = $('#root').text();
    
    expect(textContent.length).toBeGreaterThanOrEqual(500);
    expect(textContent).toContain('[NEEDS REAL COMPANY INFO]');
  });

  it('2. JSON-LD STRUCTURED DATA validates for SoftwareApplication and Organization', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    
    const $ = cheerio.load(res.text);
    const scriptContent = $('script[type="application/ld+json"]').html();
    expect(scriptContent).toBeTruthy();
    
    let jsonld;
    try {
      jsonld = JSON.parse(scriptContent!);
    } catch (e) {
      throw new Error('Failed to parse JSON-LD');
    }
    
    expect(jsonld['@context']).toBe('https://schema.org');
    expect(Array.isArray(jsonld['@graph'])).toBe(true);
    
    const graph = jsonld['@graph'] as any[];
    
    const softwareApp = graph.find(n => n['@type'] === 'SoftwareApplication');
    expect(softwareApp).toBeDefined();
    expect(softwareApp.name).toBe('Nexa');
    expect(softwareApp.description).toBeDefined();
    expect(softwareApp.url).toBeDefined();
    expect(softwareApp.applicationCategory).toBeDefined();

    const org = graph.find(n => n['@type'] === 'Organization');
    expect(org).toBeDefined();
    expect(org.contactPoint).toBeDefined();
    expect(org.contactPoint['@type']).toBe('ContactPoint');
    expect(org.contactPoint.telephone).toContain('[NEEDS REAL COMPANY INFO]');
    expect(org.contactPoint.email).toContain('[NEEDS REAL COMPANY INFO]');
    expect(org.contactPoint.contactType).toBe('Customer Support');
    
    expect(org.address).toBeDefined();
    expect(org.address['@type']).toBe('PostalAddress');
    expect(org.address.streetAddress).toContain('[NEEDS REAL COMPANY INFO]');
  });
});
