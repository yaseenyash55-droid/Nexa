-- 02_seed.sql (PostgreSQL)
-- Development seed dataset matching Oracle 03_seed.sql
-- Contains 5 users, 10 posts, follows, likes, comments, bookmarks, and notifications.

BEGIN;

-- Clean existing data
DELETE FROM notifications;
DELETE FROM bookmarks;
DELETE FROM refresh_tokens;
DELETE FROM followers;
DELETE FROM likes;
DELETE FROM comments;
DELETE FROM posts;
DELETE FROM users;

-- 1. SEED 5 USERS
-- Password for all seed users is "Password123!"
INSERT INTO users (username, email, password_hash, display_name, bio, location, website_url, profile_image_url, cover_image_url)
VALUES
(
  'alex', 
  'alex@nexa.app', 
  '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 
  'Alex Rivera', 
  'Full-stack architect & PostgreSQL enthusiast. Building Nexa social platform.', 
  'San Francisco, CA', 
  'https://alexrivera.dev', 
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80', 
  'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80'
),
(
  'sarah_design', 
  'sarah@nexa.app', 
  '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 
  'Sarah Chen', 
  'UI/UX Designer creating sleek, high-contrast dark modes and design systems.', 
  'Tokyo, Japan', 
  'https://sarahchen.design', 
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=300&q=80', 
  'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?auto=format&fit=crop&w=1200&q=80'
),
(
  'marcus_dev', 
  'marcus@nexa.app', 
  '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 
  'Marcus Vance', 
  'Backend engineer focused on high-concurrency connection pools and SQL tuning.', 
  'Austin, TX', 
  'https://marcusvance.io', 
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80', 
  'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1200&q=80'
),
(
  'elena_cloud', 
  'elena@nexa.app', 
  '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 
  'Elena Rostova', 
  'Cloud architect, distributed systems, and real-time social networking APIs.', 
  'Berlin, Germany', 
  'https://elenacloud.tech', 
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=300&q=80', 
  'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=1200&q=80'
),
(
  'david_ops', 
  'david@nexa.app', 
  '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 
  'David Miller', 
  'DevOps lead and database administrator keeping PostgreSQL clusters high-performing.', 
  'Seattle, WA', 
  'https://davidops.dev', 
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=300&q=80', 
  'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=80'
);

-- 2. SEED 10 POSTS USING USERNAME LOOKUPS
INSERT INTO posts (user_id, content, image_url, created_at)
VALUES
(
  (SELECT user_id FROM users WHERE username = 'alex'), 
  'Welcome to Nexa! 🚀 We built this social media platform using React, Express, and PostgreSQL.', 
  'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=1000&q=80', 
  CURRENT_TIMESTAMP - INTERVAL '10 hours'
),
(
  (SELECT user_id FROM users WHERE username = 'sarah_design'), 
  'Dark mode is not just an aesthetic; it reduces eye strain and brings modern visual focus to core content.', 
  'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?auto=format&fit=crop&w=1000&q=80', 
  CURRENT_TIMESTAMP - INTERVAL '8 hours'
),
(
  (SELECT user_id FROM users WHERE username = 'marcus_dev'), 
  'Pro-tip for PostgreSQL users: Always use parameterized queries ($1, $2) in production to maximize query planner caching and prevent injection!', 
  NULL,
  CURRENT_TIMESTAMP - INTERVAL '7 hours'
),
(
  (SELECT user_id FROM users WHERE username = 'elena_cloud'), 
  'Just deployed a new connection pool scaling policy. Handling 10,000 requests/sec with minimal memory footprint!', 
  'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=1000&q=80', 
  CURRENT_TIMESTAMP - INTERVAL '6 hours'
),
(
  (SELECT user_id FROM users WHERE username = 'david_ops'), 
  'Automated backup & point-in-time recovery verification passed cleanly today. Database reliability is non-negotiable.', 
  NULL,
  CURRENT_TIMESTAMP - INTERVAL '5 hours'
),
(
  (SELECT user_id FROM users WHERE username = 'alex'),
  'Refactoring backend services to use clean repository interfaces with strict PostgreSQL Database persistence.',
  'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=1000&q=80', 
  CURRENT_TIMESTAMP - INTERVAL '4 hours'
),
(
  (SELECT user_id FROM users WHERE username = 'sarah_design'), 
  'Designing responsive layouts for 360px, 768px, 1024px, and 1440px viewports. Consistency is key!', 
  NULL,
  CURRENT_TIMESTAMP - INTERVAL '3 hours'
),
(
  (SELECT user_id FROM users WHERE username = 'marcus_dev'), 
  'Cursor pagination ordered by (created_at DESC, post_id DESC) keeps feeds stable even under high write volume.', 
  NULL,
  CURRENT_TIMESTAMP - INTERVAL '2 hours'
),
(
  (SELECT user_id FROM users WHERE username = 'elena_cloud'), 
  'Sunset view from Berlin! 🌇 Coding on the terrace after shipping our latest microservice update.', 
  'https://images.unsplash.com/photo-1584438784894-089d6a62b8fa?auto=format&fit=crop&w=1000&q=80', 
  CURRENT_TIMESTAMP - INTERVAL '1 hour'
),
(
  (SELECT user_id FROM users WHERE username = 'david_ops'), 
  'Monitoring health metrics: 99.999% uptime on Supabase Cloud PostgreSQL!', 
  NULL,
  CURRENT_TIMESTAMP - INTERVAL '15 minutes'
);

-- 3. SEED FOLLOW RELATIONSHIPS
INSERT INTO followers (follower_id, following_id) VALUES ((SELECT user_id FROM users WHERE username = 'alex'), (SELECT user_id FROM users WHERE username = 'sarah_design'));
INSERT INTO followers (follower_id, following_id) VALUES ((SELECT user_id FROM users WHERE username = 'alex'), (SELECT user_id FROM users WHERE username = 'marcus_dev'));
INSERT INTO followers (follower_id, following_id) VALUES ((SELECT user_id FROM users WHERE username = 'alex'), (SELECT user_id FROM users WHERE username = 'elena_cloud'));
INSERT INTO followers (follower_id, following_id) VALUES ((SELECT user_id FROM users WHERE username = 'sarah_design'), (SELECT user_id FROM users WHERE username = 'alex'));
INSERT INTO followers (follower_id, following_id) VALUES ((SELECT user_id FROM users WHERE username = 'marcus_dev'), (SELECT user_id FROM users WHERE username = 'alex'));
INSERT INTO followers (follower_id, following_id) VALUES ((SELECT user_id FROM users WHERE username = 'david_ops'), (SELECT user_id FROM users WHERE username = 'alex'));

-- 4. SEED LIKES (SUBQUERIES)
INSERT INTO likes (post_id, user_id)
SELECT p.post_id, u.user_id FROM posts p, users u WHERE p.content LIKE 'Welcome to Nexa!%' AND u.username = 'sarah_design';

INSERT INTO likes (post_id, user_id)
SELECT p.post_id, u.user_id FROM posts p, users u WHERE p.content LIKE 'Welcome to Nexa!%' AND u.username = 'marcus_dev';

INSERT INTO likes (post_id, user_id)
SELECT p.post_id, u.user_id FROM posts p, users u WHERE p.content LIKE 'Pro-tip for PostgreSQL%' AND u.username = 'alex';

-- 5. SEED COMMENTS (SUBQUERIES)
INSERT INTO comments (post_id, user_id, content)
SELECT p.post_id, u.user_id, 'Incredible work on this full-stack architecture!'
FROM posts p, users u WHERE p.content LIKE 'Welcome to Nexa!%' AND u.username = 'sarah_design';

INSERT INTO comments (post_id, user_id, content)
SELECT p.post_id, u.user_id, 'Agreed! Parameterized queries in SQL prevent injection and keep parsing optimal.'
FROM posts p, users u WHERE p.content LIKE 'Pro-tip for PostgreSQL%' AND u.username = 'alex';

-- 6. SEED BOOKMARKS
INSERT INTO bookmarks (user_id, post_id)
SELECT u.user_id, p.post_id FROM users u, posts p WHERE u.username = 'alex' AND p.content LIKE 'Pro-tip for PostgreSQL%';

-- 7. SEED NOTIFICATIONS
INSERT INTO notifications (recipient_user_id, actor_user_id, type, post_id, is_read)
SELECT r.user_id, a.user_id, 'LIKE', p.post_id, false
FROM users r, users a, posts p 
WHERE r.username = 'alex' AND a.username = 'sarah_design' AND p.content LIKE 'Welcome to Nexa!%';

COMMIT;
