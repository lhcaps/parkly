-- V36: Fix collation mismatch in pkg_auth_revoke_user_sessions for MySQL local/runtime

DELIMITER $$

DROP PROCEDURE IF EXISTS pkg_auth_revoke_user_sessions $$
CREATE PROCEDURE pkg_auth_revoke_user_sessions(
  IN p_user_id BIGINT,
  IN p_revoked_at DATETIME,
  IN p_reason VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci,
  IN p_except_session_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci
)
BEGIN
  UPDATE auth_user_sessions
  SET revoked_at = COALESCE(p_revoked_at, CURRENT_TIMESTAMP),
      revoke_reason = COALESCE(p_reason, revoke_reason)
  WHERE user_id = p_user_id
    AND revoked_at IS NULL
    AND (
      p_except_session_id IS NULL
      OR CONVERT(session_id USING utf8mb4) COLLATE utf8mb4_0900_ai_ci <> p_except_session_id
    );
END $$

DELIMITER ;
