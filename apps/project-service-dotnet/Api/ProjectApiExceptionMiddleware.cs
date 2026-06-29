namespace ProjectService.Api;

public static class ProjectApiExceptionMiddleware
{
    public static IApplicationBuilder UseProjectApiExceptionHandling(
        this IApplicationBuilder app)
    {
        return app.Use(async (context, next) =>
        {
            try
            {
                await next(context);
            }
            catch (ProjectApiException exception)
            {
                await WriteErrorAsync(
                    context,
                    exception.StatusCode,
                    exception.Code,
                    exception.Message,
                    exception.Details);
            }
            catch (BadHttpRequestException)
            {
                await WriteErrorAsync(
                    context,
                    StatusCodes.Status400BadRequest,
                    ProjectErrorCodes.ValidationError,
                    "Request body is invalid",
                    new Dictionary<string, object?>());
            }
            catch (Exception exception)
            {
                var logger = context.RequestServices
                    .GetRequiredService<ILoggerFactory>()
                    .CreateLogger("ProjectService.Api");
                logger.LogError(
                    exception,
                    "Unhandled Project Service error. CorrelationId={CorrelationId}",
                    GetCorrelationId(context));

                await WriteErrorAsync(
                    context,
                    StatusCodes.Status500InternalServerError,
                    ProjectErrorCodes.InternalError,
                    "Unexpected server error",
                    new Dictionary<string, object?>());
            }
        });
    }

    private static async Task WriteErrorAsync(
        HttpContext context,
        int statusCode,
        string code,
        string message,
        IReadOnlyDictionary<string, object?> details)
    {
        if (context.Response.HasStarted)
        {
            return;
        }

        context.Response.StatusCode = statusCode;
        context.Response.ContentType = "application/json";

        var response = new ApiErrorResponse(
            code,
            message,
            GetCorrelationId(context),
            details);

        await context.Response.WriteAsJsonAsync(response);
    }

    private static string GetCorrelationId(HttpContext context)
    {
        var header = context.Request.Headers["x-correlation-id"].FirstOrDefault();
        return string.IsNullOrWhiteSpace(header)
            ? $"req_{Guid.NewGuid():N}"
            : header;
    }
}

internal sealed record ApiErrorResponse(
    string Code,
    string Message,
    string CorrelationId,
    IReadOnlyDictionary<string, object?> Details);
