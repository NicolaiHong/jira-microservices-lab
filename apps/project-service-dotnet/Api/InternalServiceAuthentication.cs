using System.Security.Cryptography;
using System.Text;
using ProjectService.Domain.Exceptions;

namespace ProjectService.Api;

public static class InternalServiceAuthentication
{
    private const string HeaderName = "x-internal-service-secret";

    public static IApplicationBuilder UseInternalServiceAuthentication(
        this IApplicationBuilder app,
        string secret)
    {
        if (string.IsNullOrWhiteSpace(secret))
        {
            throw new InvalidOperationException("INTERNAL_SERVICE_SECRET is required.");
        }

        var expected = Encoding.UTF8.GetBytes(secret);
        return app.Use(async (context, next) =>
        {
            if (context.Request.Path.StartsWithSegments("/health"))
            {
                await next(context);
                return;
            }

            var supplied = Encoding.UTF8.GetBytes(
                context.Request.Headers[HeaderName].FirstOrDefault() ?? string.Empty);
            if (supplied.Length != expected.Length ||
                !CryptographicOperations.FixedTimeEquals(supplied, expected))
            {
                throw new DomainException(
                    StatusCodes.Status401Unauthorized,
                    "INTERNAL_SERVICE_AUTH_REQUIRED",
                    "Valid internal service credentials are required");
            }

            await next(context);
        });
    }
}
