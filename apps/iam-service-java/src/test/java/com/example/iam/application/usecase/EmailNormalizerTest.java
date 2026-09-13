package com.example.iam.application.usecase;

import static org.junit.jupiter.api.Assertions.assertEquals;
import java.util.Locale;
import org.junit.jupiter.api.Test;

class EmailNormalizerTest {
    @Test
    void normalizationIsIndependentOfHostLocale() {
        Locale original = Locale.getDefault();
        try {
            Locale.setDefault(Locale.forLanguageTag("tr-TR"));
            assertEquals("identity@example.test", EmailNormalizer.normalize("  IDENTITY@EXAMPLE.TEST  "));
        } finally {
            Locale.setDefault(original);
        }
    }
}
