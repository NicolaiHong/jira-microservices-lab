using ProjectService.Domain;
using ProjectService.Domain.Exceptions;

namespace ProjectService.Api;

public sealed record AuthenticatedUserContext(Guid UserId);

public static class AuthContext
{
    private const string AuthenticatedUserIdHeader = "x-authenticated-user-id";

    public static AuthenticatedUserContext FromHttpContext(HttpContext httpContext)
    {
        var header = httpContext.Request.Headers[AuthenticatedUserIdHeader].FirstOrDefault();
        if (string.IsNullOrWhiteSpace(header) || !Guid.TryParse(header, out var userId))
        {
            throw new DomainException(
                401,
                ProjectErrorCodes.AuthContextRequired,
                "Authenticated user context is required");
        }

        return new AuthenticatedUserContext(userId);
    }
}
