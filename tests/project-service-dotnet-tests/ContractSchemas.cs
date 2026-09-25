using System.Text.Json;
using Json.Schema;
using Xunit;

namespace ProjectService.Tests;

// Validates bodies against the shared JSON Schemas in /contracts, copied next to the test assembly.
internal static class ContractSchemas
{
    private const string BaseUri = "https://jira-like.local/contracts/";
    private static readonly BuildOptions Build = Load();
    private static readonly EvaluationOptions Evaluation = new()
    {
        RequireFormatValidation = true,
        OutputFormat = OutputFormat.List
    };

    /// <param name="reference">Relative to /contracts, e.g. <c>http/project.schema.json#/$defs/accessContext</c>.</param>
    public static void AssertMatches(string reference, string body)
    {
        var schema = JsonSchema.FromText($$"""{ "$ref": "{{BaseUri}}{{reference}}" }""", Build);
        using var document = JsonDocument.Parse(body);
        var result = schema.Evaluate(document.RootElement, Evaluation);
        var errors = (result.Details ?? [])
            .Where(detail => detail.Errors is not null)
            .SelectMany(detail => detail.Errors!.Select(error => $"{detail.InstanceLocation}: {error.Value}"));
        Assert.True(result.IsValid, $"{reference} rejected {body}: {string.Join("; ", errors)}");
    }

    private static BuildOptions Load()
    {
        var options = new BuildOptions { SchemaRegistry = new SchemaRegistry() };
        foreach (var file in Directory.GetFiles(Path.Combine(AppContext.BaseDirectory, "contracts", "http"), "*.schema.json"))
        {
            JsonSchema.FromFile(file, options);
        }

        return options;
    }
}
