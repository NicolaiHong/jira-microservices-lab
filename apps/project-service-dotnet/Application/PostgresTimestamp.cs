namespace ProjectService.Application;

internal static class PostgresTimestamp
{
    private const long TicksPerMicrosecond = 10;

    public static DateTimeOffset UtcNow()
    {
        var now = DateTimeOffset.UtcNow;
        return new DateTimeOffset(
            now.Ticks - (now.Ticks % TicksPerMicrosecond),
            TimeSpan.Zero);
    }
}
