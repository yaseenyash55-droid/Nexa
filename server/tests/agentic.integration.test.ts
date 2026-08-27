import { test, expect, describe, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import * as http from 'http';

let server: http.Server;

beforeAll(() => {
  server = app.listen(0);
});

afterAll((done) => {
  server.close(done);
});

describe('Agentic Readiness - Sub-Prompt 1', () => {
  test('1. AGENT-FRIENDLY 404s', async () => {
    const res = await request(app).get('/a-path-that-does-not-exist');
    expect(res.status).toBe(404);
    
    const text = res.text;
    expect(text).toContain('sitemap');
    expect(text).toContain('llms.txt');
    expect(text).toContain('docs');
  });

  test('2. CONTENT WITHOUT JAVASCRIPT', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    
    // Parse HTML
    const html = res.text;
    
    // Assert 1 h1 tag
    const h1Matches = html.match(/<h1[^>]*>.*?<\/h1>/gi);
    expect(h1Matches).not.toBeNull();
    expect(h1Matches?.length).toBe(1);
    
    // Extract text content inside the #root div (to exclude head/scripts)
    const rootMatch = html.match(/<div id="root">([\s\S]*?)<\/div>/i);
    const rootContent = rootMatch ? rootMatch[1] : '';
    
    // Remove HTML tags to get raw text
    const textContent = rootContent.replace(/<[^>]+>/g, '').trim();
    expect(textContent.length).toBeGreaterThanOrEqual(500);
  });

  test('3. MARKDOWN CONTENT NEGOTIATION', async () => {
    // Default Accept
    const htmlRes = await request(app).get('/explore').set('Accept', 'text/html');
    expect(htmlRes.status).toBe(200);
    expect(htmlRes.headers['content-type']).toContain('text/html');
    expect(htmlRes.headers['vary']).toContain('Accept');

    // Markdown Accept
    const mdRes = await request(app).get('/explore').set('Accept', 'text/markdown');
    expect(mdRes.status).toBe(200);
    expect(mdRes.headers['content-type']).toContain('text/markdown');
    expect(mdRes.headers['vary']).toContain('Accept');
    expect(mdRes.text).toContain('# Nexa Page: /explore');
  });

  test('4. SITEMAP', async () => {
    const res = await request(app).get('/sitemap.xml');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/xml');
    
    const xml = res.text;
    expect(xml).toContain('<urlset');
    
    const urlMatches = xml.match(/<url>/g);
    expect(urlMatches).not.toBeNull();
    expect(urlMatches?.length).toBeGreaterThan(0);
    
    const locMatches = xml.match(/<loc>(.*?)<\/loc>/);
    expect(locMatches).not.toBeNull();
    
    // Test that the first loc resolves to 200
    if (locMatches && locMatches[1]) {
      const firstUrl = locMatches[1];
      const path = new URL(firstUrl).pathname;
      const locRes = await request(app).get(path);
      expect(locRes.status).toBe(200);
    }
  });

  test('5. METADATA COMPLETENESS', async () => {
    const res = await request(app).get('/');
    const html = res.text;
    
    expect(html).toMatch(/<html[^>]*lang="en"[^>]*>/i);
    expect(html).toContain('<link rel="canonical"');
    expect(html).toContain('property="og:image"');
    expect(html).toContain('property="og:type"');
    
    // Extract actual values to ensure they are not empty
    const canonicalMatch = html.match(/<link rel="canonical" href="([^"]+)"/i);
    expect(canonicalMatch?.[1]).toBeTruthy();
    
    const ogImageMatch = html.match(/<meta property="og:image" content="([^"]+)"/i);
    expect(ogImageMatch?.[1]).toBeTruthy();
    
    const ogTypeMatch = html.match(/<meta property="og:type" content="([^"]+)"/i);
    expect(ogTypeMatch?.[1]).toBeTruthy();
  });
});
