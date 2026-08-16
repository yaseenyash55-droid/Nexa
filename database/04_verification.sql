-- 04_verification.sql
-- Comprehensive schema verification suite for Nexa Oracle Database

SET SERVEROUTPUT ON;

PROMPT ==================================================
PROMPT 1. CURRENT SESSION & CONTAINER VERIFICATION
PROMPT ==================================================
SELECT USER, SYS_CONTEXT('USERENV', 'CON_NAME') AS CONTAINER_NAME, SYSTIMESTAMP FROM DUAL;

PROMPT ==================================================
PROMPT 2. TABLE & ROW COUNT SUMMARY
PROMPT ==================================================
SELECT table_name, num_rows 
FROM user_tables 
WHERE table_name IN ('USERS', 'POSTS', 'COMMENTS', 'LIKES', 'FOLLOWERS', 'REFRESH_TOKENS', 'BOOKMARKS', 'NOTIFICATIONS', 'MESSAGES', 'STORIES', 'REELS', 'REEL_LIKES', 'MEDIA_ASSETS', 'GROUPS', 'GROUP_MEMBERS', 'GROUP_MESSAGES', 'BROADCASTS', 'BROADCAST_RECIPIENTS')
ORDER BY table_name;

PROMPT ==================================================
PROMPT 3. IDENTITY COLUMNS VERIFICATION
PROMPT ==================================================
SELECT table_name, column_name, generation_type 
FROM user_tab_identity_cols 
ORDER BY table_name;

PROMPT ==================================================
PROMPT 4. CONSTRAINT & INDEX COUNT SUMMARY
PROMPT ==================================================
SELECT constraint_type, COUNT(*) AS count 
FROM user_constraints 
GROUP BY constraint_type 
ORDER BY constraint_type;

PROMPT ==================================================
PROMPT 5. JOINED POST, AUTHOR, LIKE & COMMENT METRICS
PROMPT ==================================================
SELECT 
  p.post_id,
  u.username AS author_username,
  SUBSTR(p.content, 1, 45) AS content_snippet,
  (SELECT COUNT(*) FROM LIKES l WHERE l.post_id = p.post_id) AS likes_count,
  (SELECT COUNT(*) FROM COMMENTS c WHERE c.post_id = p.post_id) AS comments_count
FROM POSTS p
JOIN USERS u ON p.user_id = u.user_id
ORDER BY p.created_at DESC;

PROMPT ==================================================
PROMPT 6. FOLLOWER & FOLLOWING METRICS
PROMPT ==================================================
SELECT 
  u.username,
  (SELECT COUNT(*) FROM FOLLOWERS f WHERE f.following_id = u.user_id) AS follower_count,
  (SELECT COUNT(*) FROM FOLLOWERS f WHERE f.follower_id = u.user_id) AS following_count
FROM USERS u
ORDER BY u.user_id;

PROMPT ==================================================
PROMPT 7. ORPHAN DETECTION CHECKS (MUST ALL RETURN 0)
PROMPT ==================================================
SELECT 'Orphan Posts' AS check_type, COUNT(*) AS orphan_count FROM POSTS p WHERE NOT EXISTS (SELECT 1 FROM USERS u WHERE u.user_id = p.user_id)
UNION ALL
SELECT 'Orphan Comments', COUNT(*) FROM COMMENTS c WHERE NOT EXISTS (SELECT 1 FROM POSTS p WHERE p.post_id = c.post_id)
UNION ALL
SELECT 'Orphan Likes', COUNT(*) FROM LIKES l WHERE NOT EXISTS (SELECT 1 FROM POSTS p WHERE p.post_id = l.post_id)
UNION ALL
SELECT 'Orphan Followers', COUNT(*) FROM FOLLOWERS f WHERE NOT EXISTS (SELECT 1 FROM USERS u WHERE u.user_id = f.follower_id);

PROMPT ==================================================
PROMPT 8. TRANSACTIONAL CASCADE DELETE TEST (ROLLED BACK)
PROMPT ==================================================
SAVEPOINT test_cascade;

VARIABLE cascade_user_id NUMBER;
BEGIN
  SELECT USER_ID INTO :cascade_user_id FROM USERS WHERE USERNAME = 'sarah_design';
END;
/

DELETE FROM USERS WHERE USERNAME = 'sarah_design';

SELECT 'Posts after user delete' AS metric, COUNT(*) AS count FROM POSTS WHERE USER_ID = :cascade_user_id
UNION ALL
SELECT 'Comments after user delete', COUNT(*) FROM COMMENTS WHERE USER_ID = :cascade_user_id
UNION ALL
SELECT 'Likes after user delete', COUNT(*) FROM LIKES WHERE USER_ID = :cascade_user_id;

DECLARE
  v_orphans NUMBER;
BEGIN
  SELECT
    (SELECT COUNT(*) FROM POSTS WHERE USER_ID = :cascade_user_id) +
    (SELECT COUNT(*) FROM COMMENTS WHERE USER_ID = :cascade_user_id) +
    (SELECT COUNT(*) FROM LIKES WHERE USER_ID = :cascade_user_id)
  INTO v_orphans FROM DUAL;
  IF v_orphans <> 0 THEN
    RAISE_APPLICATION_ERROR(-20010, 'Cascade verification failed');
  END IF;
END;
/

ROLLBACK TO test_cascade;

PROMPT Cascade delete assertions passed and were rolled back safely.

PROMPT ==================================================
PROMPT 9. (OPTIONAL PRIVILEGED) ACTIVE SESSIONS CHECK
PROMPT ==================================================
BEGIN
  FOR s IN (SELECT username, status, machine FROM v$session WHERE username = USER) LOOP
    DBMS_OUTPUT.PUT_LINE('Session: ' || s.username || ' | Status: ' || s.status || ' | Machine: ' || s.machine);
  END LOOP;
EXCEPTION
  WHEN OTHERS THEN
    DBMS_OUTPUT.PUT_LINE('(Optional) V$SESSION check omitted due to lack of SELECT ANY TABLE privilege.');
END;
/
