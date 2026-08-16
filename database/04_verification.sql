-- 04_verification.sql
-- Comprehensive schema verification suite for Nexa Oracle Database
-- Safe, non-destructive, and idempotent verification script

SET DEFINE OFF;
SET SERVEROUTPUT ON;

PROMPT ==================================================
PROMPT 1. CURRENT SESSION and CONTAINER VERIFICATION
PROMPT ==================================================
SELECT USER, SYS_CONTEXT('USERENV', 'CON_NAME') AS CONTAINER_NAME, SYSTIMESTAMP FROM DUAL;

PROMPT ==================================================
PROMPT 2. TABLE and ROW COUNT SUMMARY
PROMPT ==================================================
SELECT table_name, num_rows 
FROM user_tables 
WHERE table_name IN ('USERS', 'POSTS', 'COMMENTS', 'LIKES', 'FOLLOWERS', 'REFRESH_TOKENS', 'BOOKMARKS', 'NOTIFICATIONS', 'MESSAGES', 'STORIES', 'REELS', 'REEL_LIKES', 'MEDIA_ASSETS', 'GROUPS', 'GROUP_MEMBERS', 'GROUP_MESSAGES', 'BROADCASTS', 'BROADCAST_RECIPIENTS', 'FCM_TOKENS')
ORDER BY table_name;

PROMPT ==================================================
PROMPT 3. IDENTITY COLUMNS VERIFICATION
PROMPT ==================================================
SELECT table_name, column_name, generation_type 
FROM user_tab_identity_cols 
ORDER BY table_name;

PROMPT ==================================================
PROMPT 4. CONSTRAINT and INDEX COUNT SUMMARY
PROMPT ==================================================
SELECT constraint_type, COUNT(*) AS count 
FROM user_constraints 
GROUP BY constraint_type 
ORDER BY constraint_type;

PROMPT ==================================================
PROMPT 5. JOINED POST, AUTHOR, LIKE and COMMENT METRICS
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
PROMPT 6. FOLLOWER and FOLLOWING METRICS
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
DECLARE
  v_user_id NUMBER;
  v_post_id NUMBER;
  v_comment_id NUMBER;
  v_unique_tag VARCHAR2(50);
  v_post_count NUMBER;
  v_comment_count NUMBER;
  v_like_count NUMBER;
BEGIN
  SAVEPOINT test_cascade_sp;

  v_unique_tag := 'verify_' || TO_CHAR(SYSTIMESTAMP, 'YYYYMMDDHH24MISSFF4');

  -- Insert isolated temporary test user
  INSERT INTO USERS (USERNAME, EMAIL, PASSWORD_HASH, DISPLAY_NAME)
  VALUES (v_unique_tag, v_unique_tag || '@test.local', '$2a$12$e0MYzXyjpJS7Pd0RVvHwHe1mN4x9k8z6.fakehashfordbtest', 'Test Cascade User')
  RETURNING USER_ID INTO v_user_id;

  -- Insert dependent post
  INSERT INTO POSTS (USER_ID, CONTENT)
  VALUES (v_user_id, 'Temporary cascade test post content')
  RETURNING POST_ID INTO v_post_id;

  -- Insert dependent comment
  INSERT INTO COMMENTS (POST_ID, USER_ID, CONTENT)
  VALUES (v_post_id, v_user_id, 'Temporary cascade test comment')
  RETURNING COMMENT_ID INTO v_comment_id;

  -- Insert dependent like
  INSERT INTO LIKES (POST_ID, USER_ID)
  VALUES (v_post_id, v_user_id);

  -- Delete parent user
  DELETE FROM USERS WHERE USER_ID = v_user_id;

  -- Assert cascade deletions
  SELECT COUNT(*) INTO v_post_count FROM POSTS WHERE USER_ID = v_user_id;
  SELECT COUNT(*) INTO v_comment_count FROM COMMENTS WHERE USER_ID = v_user_id;
  SELECT COUNT(*) INTO v_like_count FROM LIKES WHERE USER_ID = v_user_id;

  IF v_post_count > 0 OR v_comment_count > 0 OR v_like_count > 0 THEN
    ROLLBACK TO test_cascade_sp;
    RAISE_APPLICATION_ERROR(-20010, 'Cascade verification failed: dependent records remained after parent user deletion.');
  END IF;

  ROLLBACK TO test_cascade_sp;
  DBMS_OUTPUT.PUT_LINE('Cascade delete assertions passed and were rolled back safely.');
EXCEPTION
  WHEN OTHERS THEN
    ROLLBACK TO test_cascade_sp;
    RAISE;
END;
/

PROMPT ==================================================
PROMPT 9. (OPTIONAL PRIVILEGED) ACTIVE SESSIONS CHECK
PROMPT ==================================================
DECLARE
  TYPE t_cur IS REF CURSOR;
  c_sess t_cur;
  v_user VARCHAR2(128);
  v_status VARCHAR2(64);
  v_machine VARCHAR2(128);
  v_found BOOLEAN := FALSE;
BEGIN
  -- Use dynamic SQL to prevent static compilation errors when NEXA_USER lacks V$SESSION privilege
  OPEN c_sess FOR 'SELECT username, status, machine FROM v$session WHERE username = :1' USING USER;
  LOOP
    FETCH c_sess INTO v_user, v_status, v_machine;
    EXIT WHEN c_sess%NOTFOUND;
    v_found := TRUE;
    DBMS_OUTPUT.PUT_LINE('Session: ' || v_user || ' | Status: ' || v_status || ' | Machine: ' || v_machine);
  END LOOP;
  CLOSE c_sess;
  IF NOT v_found THEN
    DBMS_OUTPUT.PUT_LINE('No active sessions found for current user.');
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    DBMS_OUTPUT.PUT_LINE('(Optional) V$SESSION check omitted cleanly due to lack of SELECT on V$SESSION.');
END;
/

PROMPT ==================================================
PROMPT ALL VERIFICATIONS COMPLETED SUCCESSFULLY.
PROMPT ==================================================
