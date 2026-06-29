using System.Text.RegularExpressions;
using ProjectService.Api;

namespace ProjectService.Application;

public static partial class RequestValidation
{
    public static string RequiredString(
        string? value,
        string field,
        int maxLength)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            throw ValidationError(field, $"{field} is required");
        }

        var normalized = value.Trim();
        if (normalized.Length > maxLength)
        {
            throw ValidationError(field, $"{field} must be {maxLength} characters or fewer");
        }

        return normalized;
    }

    public static string? OptionalString(
        string? value,
        string field,
        int maxLength)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        var normalized = value.Trim();
        if (normalized.Length > maxLength)
        {
            throw ValidationError(field, $"{field} must be {maxLength} characters or fewer");
        }

        return normalized;
    }

    public static string NormalizeSlug(string? value)
    {
        var slug = RequiredString(value, "slug", 80).ToLowerInvariant();
        slug = WhitespaceOrUnderscoreRegex().Replace(slug, "-");
        slug = RepeatedHyphenRegex().Replace(slug, "-").Trim('-');

        if (slug.Length == 0)
        {
            throw ValidationError("slug", "slug is required");
        }

        if (slug.Length > 80)
        {
            throw ValidationError("slug", "slug must be 80 characters or fewer");
        }

        if (!SlugRegex().IsMatch(slug))
        {
            throw ValidationError("slug", "slug may contain only lowercase letters, numbers, and hyphens");
        }

        return slug;
    }

    public static string NormalizeProjectKey(string? value)
    {
        var key = RequiredString(value, "key", 20).ToUpperInvariant();

        if (!ProjectKeyRegex().IsMatch(key))
        {
            throw ValidationError("key", "key may contain only uppercase letters and numbers");
        }

        return key;
    }

    public static Guid ParseUuid(string value, string field)
    {
        if (Guid.TryParse(value, out var parsed))
        {
            return parsed;
        }

        throw ValidationError(field, $"{field} must be a valid UUID");
    }

    public static ProjectApiException ValidationError(
        string field,
        string message) =>
        new(
            StatusCodes.Status400BadRequest,
            ProjectErrorCodes.ValidationError,
            "Request validation failed",
            new Dictionary<string, object?> { [field] = message });

    [GeneratedRegex(@"[\s_]+")]
    private static partial Regex WhitespaceOrUnderscoreRegex();

    [GeneratedRegex("-+")]
    private static partial Regex RepeatedHyphenRegex();

    [GeneratedRegex("^[a-z0-9]+(?:-[a-z0-9]+)*$")]
    private static partial Regex SlugRegex();

    [GeneratedRegex("^[A-Z0-9]+$")]
    private static partial Regex ProjectKeyRegex();
}
