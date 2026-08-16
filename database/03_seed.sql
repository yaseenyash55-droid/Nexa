-- 03_seed.sql
-- Seed script for Nexa Oracle Database
-- Contains 5 users, 10 posts, follows, likes, comments, bookmarks, and notifications.
-- Uses subqueries for foreign key references to avoid hardcoded identity primary key assumptions.

SET DEFINE OFF;
SET SERVEROUTPUT ON;

-- Clean existing seed data
DELETE FROM NOTIFICATIONS;
DELETE FROM BOOKMARKS;
DELETE FROM REFRESH_TOKENS;
DELETE FROM FOLLOWERS;
DELETE FROM LIKES;
DELETE FROM COMMENTS;
DELETE FROM POSTS;
DELETE FROM USERS;

-- Standard bcrypt hash for development password "Password123!"
-- Hash: $2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi

-- 1. SEED 5 USERS
INSERT INTO USERS (USERNAME, EMAIL, PASSWORD_HASH, DISPLAY_NAME, BIO, LOCATION, WEBSITE_URL, PROFILE_IMAGE_URL, COVER_IMAGE_URL)
VALUES (
  'alex', 
  'alex@nexa.app', 
  '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 
  'Alex Rivera', 
  'Full-stack architect & Oracle DB enthusiast. Building Nexa social platform.', 
  'San Francisco, CA', 
  'https://alexrivera.dev', 
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80', 
  'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80'
);

INSERT INTO USERS (USERNAME, EMAIL, PASSWORD_HASH, DISPLAY_NAME, BIO, LOCATION, WEBSITE_URL, PROFILE_IMAGE_URL, COVER_IMAGE_URL)
VALUES (
  'sarah_design', 
  'sarah@nexa.app', 
  '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 
  'Sarah Chen', 
  'UI/UX Designer creating sleek, high-contrast dark modes and design systems.', 
  'Tokyo, Japan', 
  'https://sarahchen.design', 
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=300&q=80', 
  'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?auto=format&fit=crop&w=1200&q=80'
);

INSERT INTO USERS (USERNAME, EMAIL, PASSWORD_HASH, DISPLAY_NAME, BIO, LOCATION, WEBSITE_URL, PROFILE_IMAGE_URL, COVER_IMAGE_URL)
VALUES (
  'marcus_dev', 
  'marcus@nexa.app', 
  '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 
  'Marcus Vance', 
  'Backend engineer focused on high-concurrency connection pools and SQL tuning.', 
  'Austin, TX', 
  'https://marcusvance.io', 
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80', 
  'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1200&q=80'
);

INSERT INTO USERS (USERNAME, EMAIL, PASSWORD_HASH, DISPLAY_NAME, BIO, LOCATION, WEBSITE_URL, PROFILE_IMAGE_URL, COVER_IMAGE_URL)
VALUES (
  'elena_cloud', 
  'elena@nexa.app', 
  '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 
  'Elena Rostova', 
  'Cloud architect, distributed systems, and real-time social networking APIs.', 
  'Berlin, Germany', 
  'https://elenacloud.tech', 
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=300&q=80', 
  'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=1200&q=80'
);

INSERT INTO USERS (USERNAME, EMAIL, PASSWORD_HASH, DISPLAY_NAME, BIO, LOCATION, WEBSITE_URL, PROFILE_IMAGE_URL, COVER_IMAGE_URL)
VALUES (
  'david_ops', 
  'david@nexa.app', 
  '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 
  'David Miller', 
  'DevOps lead and database administrator keeping Oracle clusters high-performing.', 
  'Seattle, WA', 
  'https://davidops.dev', 
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=300&q=80', 
  'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=80'
);

-- 2. SEED 10 POSTS USING USERNAME LOOKUPS
INSERT INTO POSTS (USER_ID, CONTENT, IMAGE_URL, CREATED_AT)
VALUES (
  (SELECT USER_ID FROM USERS WHERE USERNAME = 'alex'), 
  'Welcome to Nexa! 🚀 We built this social media platform using React, Express, and Oracle Database.', 
  'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=1000&q=80', 
  SYSTIMESTAMP - INTERVAL '10' HOUR
);

INSERT INTO POSTS (USER_ID, CONTENT, IMAGE_URL, CREATED_AT)
VALUES (
  (SELECT USER_ID FROM USERS WHERE USERNAME = 'sarah_design'), 
  'Dark mode is not just an aesthetic; it reduces eye strain and brings modern visual focus to core content.', 
  'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?auto=format&fit=crop&w=1000&q=80', 
  SYSTIMESTAMP - INTERVAL '8' HOUR
);

INSERT INTO POSTS (USER_ID, CONTENT, CREATED_AT)
VALUES (
  (SELECT USER_ID FROM USERS WHERE USERNAME = 'marcus_dev'), 
  'Pro-tip for Oracle Database users: Always use bind variables (`:1`, `:2` or `:param`) in production queries to maximize cursor sharing!', 
  SYSTIMESTAMP - INTERVAL '7' HOUR
);

INSERT INTO POSTS (USER_ID, CONTENT, IMAGE_URL, CREATED_AT)
VALUES (
  (SELECT USER_ID FROM USERS WHERE USERNAME = 'elena_cloud'), 
  'Just deployed a new connection pool scaling policy. Handling 10,000 requests/sec with minimal memory footprint!', 
  'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=1000&q=80', 
  SYSTIMESTAMP - INTERVAL '6' HOUR
);

INSERT INTO POSTS (USER_ID, CONTENT, CREATED_AT)
VALUES (
  (SELECT USER_ID FROM USERS WHERE USERNAME = 'david_ops'), 
  'Automated backup & point-in-time recovery verification passed cleanly today. Database reliability is non-negotiable.', 
  SYSTIMESTAMP - INTERVAL '5' HOUR
);

INSERT INTO POSTS (USER_ID, CONTENT, IMAGE_URL, CREATED_AT)
VALUES (
  (SELECT USER_ID FROM USERS WHERE USERNAME = 'alex'),
  'Refactoring backend services to use clean repository interfaces with strict Oracle Database persistence.',
  'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=1000&q=80', 
  SYSTIMESTAMP - INTERVAL '4' HOUR
);

INSERT INTO POSTS (USER_ID, CONTENT, CREATED_AT)
VALUES (
  (SELECT USER_ID FROM USERS WHERE USERNAME = 'sarah_design'), 
  'Designing responsive layouts for 360px, 768px, 1024px, and 1440px viewports. Consistency is key!', 
  SYSTIMESTAMP - INTERVAL '3' HOUR
);

INSERT INTO POSTS (USER_ID, CONTENT, CREATED_AT)
VALUES (
  (SELECT USER_ID FROM USERS WHERE USERNAME = 'marcus_dev'), 
  'Cursor pagination ordered by `(CREATED_AT DESC, POST_ID DESC)` keeps feeds stable even under high write volume.', 
  SYSTIMESTAMP - INTERVAL '2' HOUR
);

INSERT INTO POSTS (USER_ID, CONTENT, IMAGE_URL, CREATED_AT)
VALUES (
  (SELECT USER_ID FROM USERS WHERE USERNAME = 'elena_cloud'), 
  'Sunset view from Berlin! 🌇 Coding on the terrace after shipping our latest microservice update.', 
  'https://images.unsplash.com/photo-1584438784894-089d6a62b8fa?auto=format&fit=crop&w=1000&q=80', 
  SYSTIMESTAMP - INTERVAL '1' HOUR
);

INSERT INTO POSTS (USER_ID, CONTENT, CREATED_AT)
VALUES (
  (SELECT USER_ID FROM USERS WHERE USERNAME = 'david_ops'), 
  'Monitoring health metrics: 99.999% uptime on Oracle 23c Free container!', 
  SYSTIMESTAMP - INTERVAL '15' MINUTE
);

-- 3. SEED FOLLOW RELATIONSHIPS
INSERT INTO FOLLOWERS (FOLLOWER_ID, FOLLOWING_ID) VALUES ((SELECT USER_ID FROM USERS WHERE USERNAME = 'alex'), (SELECT USER_ID FROM USERS WHERE USERNAME = 'sarah_design'));
INSERT INTO FOLLOWERS (FOLLOWER_ID, FOLLOWING_ID) VALUES ((SELECT USER_ID FROM USERS WHERE USERNAME = 'alex'), (SELECT USER_ID FROM USERS WHERE USERNAME = 'marcus_dev'));
INSERT INTO FOLLOWERS (FOLLOWER_ID, FOLLOWING_ID) VALUES ((SELECT USER_ID FROM USERS WHERE USERNAME = 'alex'), (SELECT USER_ID FROM USERS WHERE USERNAME = 'elena_cloud'));
INSERT INTO FOLLOWERS (FOLLOWER_ID, FOLLOWING_ID) VALUES ((SELECT USER_ID FROM USERS WHERE USERNAME = 'sarah_design'), (SELECT USER_ID FROM USERS WHERE USERNAME = 'alex'));
INSERT INTO FOLLOWERS (FOLLOWER_ID, FOLLOWING_ID) VALUES ((SELECT USER_ID FROM USERS WHERE USERNAME = 'marcus_dev'), (SELECT USER_ID FROM USERS WHERE USERNAME = 'alex'));
INSERT INTO FOLLOWERS (FOLLOWER_ID, FOLLOWING_ID) VALUES ((SELECT USER_ID FROM USERS WHERE USERNAME = 'david_ops'), (SELECT USER_ID FROM USERS WHERE USERNAME = 'alex'));

-- 4. SEED LIKES (SUBQUERIES)
INSERT INTO LIKES (POST_ID, USER_ID)
SELECT p.POST_ID, u.USER_ID FROM POSTS p, USERS u WHERE p.CONTENT LIKE 'Welcome to Nexa!%' AND u.USERNAME = 'sarah_design';

INSERT INTO LIKES (POST_ID, USER_ID)
SELECT p.POST_ID, u.USER_ID FROM POSTS p, USERS u WHERE p.CONTENT LIKE 'Welcome to Nexa!%' AND u.USERNAME = 'marcus_dev';

INSERT INTO LIKES (POST_ID, USER_ID)
SELECT p.POST_ID, u.USER_ID FROM POSTS p, USERS u WHERE p.CONTENT LIKE 'Pro-tip for Oracle%' AND u.USERNAME = 'alex';

-- 5. SEED COMMENTS (SUBQUERIES)
INSERT INTO COMMENTS (POST_ID, USER_ID, CONTENT)
SELECT p.POST_ID, u.USER_ID, 'Incredible work on this full-stack architecture!'
FROM POSTS p, USERS u WHERE p.CONTENT LIKE 'Welcome to Nexa!%' AND u.USERNAME = 'sarah_design';

INSERT INTO COMMENTS (POST_ID, USER_ID, CONTENT)
SELECT p.POST_ID, u.USER_ID, 'Agreed! Hardcoded literal strings in SQL are a huge anti-pattern.'
FROM POSTS p, USERS u WHERE p.CONTENT LIKE 'Pro-tip for Oracle%' AND u.USERNAME = 'alex';

-- 6. SEED BOOKMARKS
INSERT INTO BOOKMARKS (USER_ID, POST_ID)
SELECT u.USER_ID, p.POST_ID FROM USERS u, POSTS p WHERE u.USERNAME = 'alex' AND p.CONTENT LIKE 'Pro-tip for Oracle%';

-- 7. SEED NOTIFICATIONS
INSERT INTO NOTIFICATIONS (RECIPIENT_USER_ID, ACTOR_USER_ID, TYPE, POST_ID, IS_READ)
SELECT r.USER_ID, a.USER_ID, 'LIKE', p.POST_ID, 0
FROM USERS r, USERS a, POSTS p 
WHERE r.USERNAME = 'alex' AND a.USERNAME = 'sarah_design' AND p.CONTENT LIKE 'Welcome to Nexa!%';

COMMIT;
DBMS_OUTPUT.PUT_LINE('Nexa seed dataset populated successfully.');
/
