import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import SwaggerParser from '@apidevtools/swagger-parser';
import path from 'path';
import { app } from '../src/app.js';

// Mock the PostService to prevent DB connection errors in integration tests
vi.mock('../src/services/post.service.js', () => {
  return {
    PostService: vi.fn().mockImplementation(() => {
      return {
        getGlobalFeed: vi.fn().mockResolvedValue({
          data: [{ id: 1, content: 'Test post', userId: 1 }],
          nextCursor: null,
          hasMore: false
        })
      };
    })
  };
});

describe('API Surface & Agentic Readiness - Sub-Prompt 2', () => {

  it('1. PUBLIC API WITH REACHABLE ENDPOINTS - Public Feed', async () => {
    // Calling the public feed endpoint without auth
    const res = await request(app).get('/api/posts/feed');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/json');
    expect(res.body.data).toBeDefined();
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('2. OPENAPI SPEC PUBLISHED & PARSEABLE', async () => {
    // 2a. Endpoint returns valid JSON
    const res = await request(app).get('/openapi.json');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/json');

    const spec = res.body;
    expect(spec.openapi).toBe('3.0.3');

    // 2b. Parse and Validate the Spec fully using SwaggerParser
    const openapiPath = path.join(process.cwd(), 'src', 'docs', 'openapi.json');
    const parsedSpec = await SwaggerParser.validate(openapiPath);
    
    expect(parsedSpec).toBeDefined();
    expect(parsedSpec.paths).toHaveProperty('/posts/feed');
    expect(parsedSpec.paths).toHaveProperty('/users/username/{username}');
    
    // Check for operationId and descriptions on public feed
    const getFeed = parsedSpec.paths['/posts/feed'].get;
    expect(getFeed.operationId).toBeDefined();
    expect(getFeed.description).toBeDefined();
  });

  it('3. JSON ERROR RESPONSES (RFC 7807 problem+json)', async () => {
    // Trigger a 404 error
    const res404 = await request(app).get('/api/unknown-endpoint');
    expect(res404.status).toBe(404);
    expect(res404.headers['content-type']).toContain('application/problem+json');
    expect(res404.body).toHaveProperty('type');
    expect(res404.body).toHaveProperty('title');
    expect(res404.body).toHaveProperty('status');
    expect(res404.body).toHaveProperty('detail');

    // Trigger a 401 error (unauthorized on protected route)
    const res401 = await request(app).post('/api/posts/create');
    expect(res401.status).toBe(401);
    expect(res401.headers['content-type']).toContain('application/problem+json');
    expect(res401.body.title).toBe('UNAUTHORIZED');
  });

  it('4. PUBLIC API/DOCS LINKED FROM HOMEPAGE', async () => {
    // Fetch homepage raw HTML (SSR fallback handles it)
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('<a href="/api-docs">');
  });

  it('5. AGENT INSTRUCTION / WHEN-TO-USE in /llms.txt', async () => {
    const res = await request(app).get('/llms.txt');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/plain');
    
    const content = res.text;
    expect(content.toLowerCase()).toContain('when to use this');
    expect(content).toContain('GET /api/users/username/{username}');
    expect(content).toContain('GET /api/posts/feed');
  });

});
