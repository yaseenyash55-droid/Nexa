import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';

describe('Sub-Prompt 3: Trust/Discoverability Verification', () => {

  const routes = ['/about', '/contact', '/privacy'];

  it.each(routes)('1. TRUST ANCHOR PAGES: %s has >= 500 chars and 200 status', async (route) => {
    const res = await request(app).get(route);
    expect(res.status).toBe(200);
    
    // Extract text content inside <div id="root">
    const rootMatch = res.text.match(/<div id="root">([\s\S]*?)<\/div>/);
    expect(rootMatch).not.toBeNull();
    
    if (rootMatch) {
      // Strip HTML tags to get raw text length
      const textContent = rootMatch[1].replace(/<[^>]*>?/gm, '').trim();
      expect(textContent.length).toBeGreaterThanOrEqual(500);
      // Ensure it contains placeholder info
      expect(textContent).toContain('[NEEDS REAL COMPANY INFO]');
    }
  });

  it('2. JSON-LD STRUCTURED DATA: Homepage has valid SoftwareApplication and Organization', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);

    const jsonLdMatch = res.text.match(/<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/);
    expect(jsonLdMatch).not.toBeNull();
    
    if (jsonLdMatch) {
      const jsonLd = JSON.parse(jsonLdMatch[1]);
      
      expect(jsonLd['@context']).toBe('https://schema.org');
      expect(jsonLd['@graph']).toBeDefined();
      
      const softwareApp = jsonLd['@graph'].find((g: any) => g['@type'] === 'SoftwareApplication');
      expect(softwareApp).toBeDefined();
      expect(softwareApp.name).toBe('Nexa');
      expect(softwareApp.description).toBeDefined();
      expect(softwareApp.url).toBeDefined();
      
      const organization = jsonLd['@graph'].find((g: any) => g['@type'] === 'Organization');
      expect(organization).toBeDefined();
      expect(organization.contactPoint).toBeDefined();
      expect(organization.contactPoint.telephone).toContain('[NEEDS REAL COMPANY INFO]');
      expect(organization.contactPoint.contactType).toBeDefined();
      expect(organization.address).toBeDefined();
      expect(organization.address.streetAddress).toContain('[NEEDS REAL COMPANY INFO]');
    }
  });

  it('3. BRAND NAME DISCOVERABILITY: Ensure NAP is consistent', async () => {
    const res = await request(app).get('/about');
    expect(res.text).toContain('Company Legal Name: Nexa Social Inc. [NEEDS REAL COMPANY INFO]');
    expect(res.text).toContain('Headquarters: [NEEDS REAL COMPANY INFO] 123 Social Avenue, San Francisco, CA 94107, US');
  });

});
