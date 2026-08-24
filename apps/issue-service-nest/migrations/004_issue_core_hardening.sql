DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM issues
        WHERE description IS NOT NULL
          AND char_length(description) > 5000
    ) THEN
        RAISE EXCEPTION
            'Cannot apply 004_issue_core_hardening: issues.description contains values longer than 5000 characters';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_issues_description_length'
          AND conrelid = 'issues'::regclass
    ) THEN
        ALTER TABLE issues
            ADD CONSTRAINT chk_issues_description_length
            CHECK (description IS NULL OR char_length(description) <= 5000);
    END IF;
END $$;
