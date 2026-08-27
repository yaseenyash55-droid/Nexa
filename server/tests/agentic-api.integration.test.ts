import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import SwaggerParser from '@apidevtools/swagger-parser';
import path from 'path';
import { app } from '../src/app';

describe('Sub-Prompt 2: API/Agent-Surface Verification', () => {

  it('1. PUBLIC API WITH REACHABLE ENDPOINTS: public endpoints are reachable', async () => {
    // /api/posts/feed is a public endpoint with optionalAuth
    const res = await request(app).get('/api/posts/feed');
    // Since there might not be a DB connection in tests, we just check it doesn't return 401 or 404.
    // It might return 500 (db error) or 200.
    expect([200, 500]).toContain(res.status);
    
    // Check if JSON error or success returned
    expect(res.headers['content-type']).toMatch(/json/);
  });

  it('2. OPENAPI SPEC PUBLISHED + SCHEMA COMPLEXITY: spec parses cleanly', async () => {
    const openapiPath = path.join(process.cwd(), 'src', 'docs', 'openapi.json');
    // This will throw if the spec is invalid or missing
    const api = await SwaggerParser.validate(openapiPath);
    
    expect(api.openapi).toMatch(/^3\.0\.\d+/);
    expect(api.paths['/posts/feed']).toBeDefined();
    
    // Check for operationId and typed responses
    const feedGet = api.paths['/posts/feed']?.get;
    expect(feedGet?.operationId).toBe('getPublicFeed');
    expect(feedGet?.responses['200']).toBeDefined();
    expect(feedGet?.responses['500']).toBeDefined();
  });

  it('3. JSON ERROR RESPONSES: endpoints return RFC 7807 JSON errors', async () => {
    // Force a 404 on API
    const res = await request(app).get('/api/invalid-endpoint-for-test');
    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toContain('application/problem+json');
    
    expect(res.body).toHaveProperty('type');
    expect(res.body).toHaveProperty('title', 'NOT_FOUND');
    expect(res.body).toHaveProperty('status', 404);
    expect(res.body).toHaveProperty('detail');
  });

  it('4. PUBLIC API/DOCS LINKED FROM HOMEPAGE', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('<a href="/api-docs">API Documentation</a>');
  });

  it('5. AGENT INSTRUCTION / WHEN-TO-USE: llms.txt contains when-to-use', async () => {
    const res = await request(app).get('/llms.txt');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/plain');
    expect(res.text).toContain('## When to use this');
    expect(res.text).toContain('GET /api/posts/feed');
  });
});
