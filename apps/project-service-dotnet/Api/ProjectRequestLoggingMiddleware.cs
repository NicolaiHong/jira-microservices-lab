using System.Diagnostics;

namespace ProjectService.Api;

public static class ProjectRequestLoggingMiddleware
{
    public static IApplicationBuilder UseProjectRequestLogging(
        this IApplicationBuilder app)
    {
        return app.Use(async (context, next) =>
        {
            var correlationId = CorrelationId.GetOrCreate(context);
            var logger = context.RequestServices
                .GetRequiredService<ILoggerFactory>()
                .CreateLogger("ProjectService.HttpRequest");
            var stopwatch = Stopwatch.StartNew();

            using (logger.BeginScope(new Dictionary<string, object?>
                   {
                       ["CorrelationId"] = correlationId
                   }))
            {
                await next(context);
                stopwatch.Stop();
                logger.LogInformation(
                    "HTTP {Method} {Path} responded {StatusCode} in {DurationMs}ms. CorrelationId={CorrelationId}",
                    context.Request.Method,
                    context.Request.Path,
                    context.Response.StatusCode,
                    stopwatch.ElapsedMilliseconds,
                    correlationId);
            }
        });
    }
}
