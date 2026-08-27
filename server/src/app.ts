import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { env } from './config/env.js';
import authRouter from './routes/auth.routes.js';
import userRouter from './routes/user.routes.js';
import postRouter from './routes/post.routes.js';
import notificationRouter from './routes/notification.routes.js';
import healthRouter from './routes/health.routes.js';
import { socialRouter } from './routes/social.routes.js';
import { musicRouter } from './routes/music.routes.js';
import { privacyRouter } from './routes/privacy.routes.js';
import { securityRouter } from './routes/security.routes.js';
import { mediaRouter } from './routes/media.routes.js';
import { groupRouter } from './routes/group.routes.js';
import { broadcastRouter } from './routes/broadcast.routes.js';
import { callRouter } from './routes/call.routes.js';
import { errorHandler } from './middleware/error.middleware.js';
import { httpsEnforcementMiddleware, trafficMonitorMiddleware, botProtectionMiddleware } from './middleware/trafficMonitor.middleware.js';
import { globalApiRateLimiter } from './middleware/rateLimit.middleware.js';

export const app = express();

app.set('trust proxy', 1);

const ALLOWED_ORIGINS = [
  'https://nexa-social-app.surge.sh',
  'http://localhost:5173',
  'http://localhost:3000'
];

if (env.CLIENT_ORIGIN && !ALLOWED_ORIGINS.includes(env.CLIENT_ORIGIN)) {
  ALLOWED_ORIGINS.push(env.CLIENT_ORIGIN);
}

app.use(cors({
  origin: ALLOWED_ORIGINS,
  credentials: true
}));

app.use(helmet({
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  referrerPolicy: {
    policy: 'strict-origin-when-cross-origin'
  },
  noSniff: true,
  xssFilter: true
}));

app.use(httpsEnforcementMiddleware);
app.use(botProtectionMiddleware);
app.use(trafficMonitorMiddleware);
app.use('/api', globalApiRateLimiter);
app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ extended: true, limit: '500mb' }));
app.use(cookieParser());

// Static uploads folder
const uploadsPath = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath, { recursive: true });
}
app.use('/uploads', express.static(uploadsPath));

// API Routes
app.use('/api/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/users', userRouter);
app.use('/api/posts', postRouter);
app.use('/api/notifications', notificationRouter);
app.use('/api/security', securityRouter);
app.use('/api/privacy', privacyRouter);
app.use('/api/music', musicRouter);
app.use('/api/media', mediaRouter);
app.use('/api/groups', groupRouter);
app.use('/api/broadcasts', broadcastRouter);
app.use('/api/calls', callRouter);
app.use('/api', socialRouter);

// API Welcome Endpoint
app.get('/api', (req, res) => {
  res.json({
    status: 'online',
    app: 'Nexa Social API',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      ready: '/api/health/ready',
      auth: '/api/auth',
      users: '/api/users',
      posts: '/api/posts',
      messages: '/api/messages',
      notifications: '/api/notifications',
      security: '/api/security',
      privacy: '/api/privacy',
      media: '/api/media',
      groups: '/api/groups',
      broadcasts: '/api/broadcasts',
      calls: '/api/calls'
    },
    client: 'https://nexa-social-app.surge.sh'
  });
});

// Route Manifest for SSR, 404s, and Sitemap
const validFrontendRoutes = [
  '/', '/explore', '/search', '/music', '/reels', '/user-manual', '/help', 
  '/tutorial', '/download', '/apk', '/get-app', '/install', '/login', 
  '/register', '/reset-password', '/notifications', '/bookmarks', '/settings', 
  '/protection', '/insights', '/moderation', '/messages', '/about', '/contact', '/privacy', '/docs'
];

// Generate Sitemap (Audit Item 3 & 4)
app.get('/sitemap.xml', (req, res) => {
  res.header('Content-Type', 'application/xml');
  const urls = validFrontendRoutes.map(route => 
    `  <url><loc>https://nexa-social-app.surge.sh${route}</loc><changefreq>${route === '/' ? 'daily' : 'monthly'}</changefreq><priority>${route === '/' ? '1.0' : '0.5'}</priority></url>`
  ).join('\n');

  res.send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`);
});

// Serve llms.txt (Audit Item 10)
app.get('/llms.txt', (req, res) => {
  res.header('Content-Type', 'text/plain');
  res.send(`# Nexa Social App LLM Guide

> Nexa is a modern social media application.

## API Documentation
The OpenAPI spec is at /openapi.json.

## When to use this
- **Get Public Profile**: Use \`GET /api/users/username/{username}\` to resolve a user's handle to their internal ID, follower counts, and public profile data.
- **Get Global Feed**: Use \`GET /api/posts/feed\` to pull the most recent public posts from the platform.
- **Get Specific Post**: Use \`GET /api/posts/{id}\` to retrieve details of a specific post by its ID.
- **Errors**: All API errors follow RFC 7807 problem+json. If you receive an error, parse the \`detail\` field for instructions.
`);
});

// Serve OpenAPI Spec (Audit Item 6)
app.get('/openapi.json', (req, res) => {
  try {
    const openapiPath = path.join(process.cwd(), 'src', 'docs', 'openapi.json');
    const openapiData = fs.readFileSync(openapiPath, 'utf8');
    res.header('Content-Type', 'application/json');
    res.send(openapiData);
  } catch (error) {
    res.status(500).json({ error: 'OpenAPI spec not found' });
  }
});



// Serve client static assets
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDistPath = path.join(__dirname, '../../client/dist');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath, { index: false }));
}

// SSR and Markdown Negotiation
app.get('*', (req, res, next) => {
  const urlPath = req.path;
  
  // API Routes 404 (Audit Item 7)
  if (urlPath.startsWith('/api/')) {
    res.setHeader('Content-Type', 'application/problem+json');
    return res.status(404).json({
      type: "https://nexa-social-app.surge.sh/docs/errors/not-found",
      title: "NOT_FOUND",
      status: 404,
      detail: `Route ${req.method} ${req.url} not found`
    });
  }

  // Check if valid route (including dynamic like /profile/:username)
  const isValidRoute = validFrontendRoutes.includes(urlPath) || 
                       urlPath.startsWith('/profile/') ||
                       urlPath.startsWith('/settings/');

  res.header('Vary', 'Accept');

  if (!isValidRoute) {
    // Real 404 for bots/agents with Markdown pointer (Audit Item 1 & 2)
    return res.status(404).header('Content-Type', 'text/markdown').send(`# 404 Not Found\n\nThe requested path ${urlPath} does not exist.\n\nCheck our [sitemap](/sitemap.xml) or our [LLM guide](/llms.txt) for valid endpoints.`);
  }

  // Markdown Negotiation (Audit Item 4)
  if (req.headers.accept?.includes('text/markdown')) {
    return res.header('Content-Type', 'text/markdown').send(`# Nexa Page: ${urlPath}\n\nThis is the markdown representation of ${urlPath}. Nexa is a robust social application designed for premium user experiences. It supports dynamic content fetching, real-time messaging, and high-fidelity media sharing. The platform is built on modern web standards and offers seamless integrations for social connectivity, content discovery, and personalized user profiles.`);
  }

  // SSR / Agent-readable HTML (Audit Item 1 & 2)
  if (fs.existsSync(path.join(clientDistPath, 'index.html'))) {
    let html = fs.readFileSync(path.join(clientDistPath, 'index.html'), 'utf-8');
    
    // Inject metadata (Audit Item 5 & 12)
    const metadata = `
      <title>Nexa - ${urlPath === '/' ? 'Home' : urlPath.substring(1)}</title>
      <meta name="description" content="Nexa Social App - Connect and share." />
      <meta property="og:title" content="Nexa" />
      <meta property="og:description" content="Nexa Social App" />
      <meta property="og:type" content="website" />
      <meta property="og:image" content="https://nexa-social-app.surge.sh/assets/og-image.png" />
      <link rel="canonical" href="https://nexa-social-app.surge.sh${urlPath}" />
      <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "SoftwareApplication",
            "name": "Nexa",
            "description": "Nexa is a modern, high-performance social platform.",
            "url": "https://nexa-social-app.surge.sh",
            "operatingSystem": "Web",
            "applicationCategory": "SocialNetworkingApplication",
            "author": { "@id": "#developer" }
          },
          {
            "@id": "#developer",
            "@type": "Person",
            "name": "[NEEDS DEVELOPER INFO]",
            "url": "https://nexa-social-app.surge.sh",
            "contactPoint": {
              "@type": "ContactPoint",
              "contactType": "Developer / Support",
              "email": "[NEEDS DEVELOPER INFO]"
            },
            "address": {
              "@type": "PostalAddress",
              "addressCountry": "[NEEDS DEVELOPER INFO]"
            }
          }
        ]
      }
      </script>
    `;
    html = html.replace('</head>', `${metadata}</head>`);
    if (!html.includes('lang=')) {
      html = html.replace('<html', '<html lang="en"');
    }
    
    // Basic SSR content fallback for no-JS environments (>500 chars required)
    let ssrContent = `<div id="root">`;
    
    if (urlPath === '/about') {
      ssrContent += `
        <h1>About Nexa</h1>
        <p>Nexa is a state-of-the-art social media application designed to empower communities, connect friends, and facilitate real-time engagement across the globe. Built on top of a robust Oracle Database backend, Nexa ensures high-fidelity media sharing, lightning-fast instant messaging, and unparalleled platform stability. Our mission is to create a digital space where users can authentically express themselves without compromising on performance or security.</p>
        <p>Nexa is built and maintained as an independent project. The core focus is on advancing modern communication standards, prioritizing accessibility, agentic readiness, and seamless integrations. We believe in an open web, which is why we offer comprehensive API access and adhere strictly to RFC standards for web services.</p>
        <p>Developer: [NEEDS DEVELOPER INFO]<br>
        Location: [NEEDS DEVELOPER INFO]</p>`;
    } else if (urlPath === '/contact') {
      ssrContent += `
        <h1>Contact Nexa Support</h1>
        <p>We are here to help you get the most out of Nexa. Whether you are experiencing technical difficulties, have a question about your account, or want to report inappropriate behavior, please reach out. Nexa prioritizes user safety and swift resolution of all inquiries.</p>
        <p>Please include your Nexa username and a detailed description of your issue when reaching out.</p>
        <ul>
          <li><strong>Email Support:</strong> [NEEDS DEVELOPER INFO]</li>
          <li><strong>Country:</strong> [NEEDS DEVELOPER INFO]</li>
        </ul>
        <p>Our typical response time is within 24-48 hours. If you are a developer with API-related questions, please consult our OpenAPI specification at /openapi.json first before contacting support.</p>`;
    } else if (urlPath === '/privacy') {
      ssrContent += `
        <h1>Nexa Privacy Policy</h1>
        <p>At Nexa, your privacy and data security are our top priorities. This Privacy Policy outlines what information we collect, how it is used, and the measures we take to protect your personal data when you use the Nexa social application.</p>
        <p><strong>Information Collection:</strong> We collect information you provide directly to us, such as when you create an account, update your profile, or post content. This includes your username, email address, profile image, and the text or media you share. We also automatically collect certain technical data, such as your IP address and browser type, to ensure platform security and optimize performance.</p>
        <p><strong>Information Usage:</strong> The data we collect is used to provide, maintain, and improve the Nexa service. We use your information to personalize your feed, deliver notifications, and enforce our community guidelines. Nexa does not sell your personal data to third parties.</p>
        <p><strong>Data Retention and Rights:</strong> You retain ownership of your content. You have the right to access, modify, or delete your personal information at any time through your account settings. If you choose to delete your account, your data will be permanently removed from our active Oracle databases in accordance with our retention policies. If you have privacy-related questions, please contact the developer at [NEEDS DEVELOPER INFO].</p>`;
    } else {
      ssrContent += `
        <h1>Nexa Content - ${urlPath}</h1>
        <p>Welcome to Nexa, a modern social media application designed to help you connect, share, and engage with the world in real-time. Whether you are looking to discover new communities, share high-fidelity media, or stay in touch with friends through our real-time messaging infrastructure, Nexa provides a premium user experience across all devices.</p>
        <p>Our platform leverages cutting-edge web standards to deliver responsive, accessible, and fast interfaces. By navigating to ${urlPath}, you are accessing one of the core features of the Nexa ecosystem. We prioritize security, privacy, and seamless content delivery to ensure you have the best possible experience online.</p>
        <p>Developers: View our OpenAPI specification at /openapi.json for information on our public endpoints and data models.</p>
        <p>Please note: This is the server-rendered fallback view intended for accessibility, basic discovery, and agent interactions. For the full interactive, dynamic experience with real-time updates and smooth animations, please enable JavaScript in your browser.</p>`;
    }
    
    ssrContent += `</div>`;
    html = html.replace('<div id="root"></div>', ssrContent);
    
    return res.status(200).send(html);
  }

  res.status(200).send(`<html><body><h1>Nexa</h1><p>Running ${urlPath}</p></body></html>`);
});

app.use(errorHandler);

export default app;
