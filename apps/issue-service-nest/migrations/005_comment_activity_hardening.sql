DO $$
DECLARE
    invalid_comments TEXT;
BEGIN
    SELECT string_agg(
        format('%s:%s', id, char_length(body)),
        ', '
        ORDER BY id
    )
    INTO invalid_comments
    FROM issue_comments
    WHERE char_length(body) > 5000
       OR body !~ '[^[:space:]]';

    IF invalid_comments IS NOT NULL THEN
        RAISE EXCEPTION
            'Cannot apply 005_comment_activity_hardening: invalid issue_comments (id:length): %',
            invalid_comments;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_issue_comments_body_nonblank'
          AND conrelid = 'issue_comments'::regclass
    ) THEN
        ALTER TABLE issue_comments
            ADD CONSTRAINT chk_issue_comments_body_nonblank
            CHECK (body ~ '[^[:space:]]');
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_issue_comments_body_length'
          AND conrelid = 'issue_comments'::regclass
    ) THEN
        ALTER TABLE issue_comments
            ADD CONSTRAINT chk_issue_comments_body_length
            CHECK (char_length(body) <= 5000);
    END IF;
END $$;
