package com.example.iam.presentation;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.networknt.schema.JsonSchemaFactory;
import com.networknt.schema.SchemaLocation;
import com.networknt.schema.SchemaValidatorsConfig;
import com.networknt.schema.SpecVersion;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Path;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;

/** Real /auth responses of a running IAM against the shared schemas in /contracts. */
@SpringBootTest(
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
    properties = {
        "INTERNAL_SERVICE_SECRET=" + AuthContractTest.SECRET,
        "spring.datasource.url=jdbc:h2:mem:iam-contract;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.flyway.enabled=false",
        "spring.jpa.hibernate.ddl-auto=create-drop"
    }
)
class AuthContractTest {
    static final String SECRET = "iam-contract-test-secret";
    private static final String CONTRACTS = "https://jira-like.local/contracts/";
    private static final JsonSchemaFactory SCHEMAS = JsonSchemaFactory.getInstance(
        SpecVersion.VersionFlag.V202012,
        builder -> builder.schemaMappers(mappers -> mappers.mapPrefix(
            CONTRACTS,
            Path.of("../../contracts").toAbsolutePath().normalize().toUri().toString()
        ))
    );
    private static final SchemaValidatorsConfig CONFIG =
        SchemaValidatorsConfig.builder().formatAssertionsEnabled(true).build();
    private final ObjectMapper json = new ObjectMapper();

    private final HttpClient http = HttpClient.newHttpClient();

    @LocalServerPort
    int port;

    @Test
    void sessionResponsesMatchTheIamContract() throws Exception {
        var credentials = Map.of("email", "contract-session@example.test", "password", "password-123");
        assertContract("http/iam.schema.json#/$defs/registerResponse", post("/auth/register", credentials, 201));
        var session = post("/auth/login", credentials, 200);
        assertContract("http/iam.schema.json#/$defs/sessionResponse", session);
        var refreshed = post("/auth/refresh", Map.of("refreshToken", session.get("refreshToken").asText()), 200);
        assertContract("http/iam.schema.json#/$defs/sessionResponse", refreshed);
    }

    @Test
    void failuresUseTheErrorEnvelope() throws Exception {
        var credentials = Map.of("email", "contract-errors@example.test", "password", "password-123");
        post("/auth/register", credentials, 201);
        var failures = new JsonNode[] {
            post("/auth/register", Map.of("email", "not-an-email", "password", "short"), 400),
            post("/auth/register", credentials, 409),
            post("/auth/login", Map.of("email", "contract-errors@example.test", "password", "wrong-password"), 401),
            post("/auth/refresh", Map.of("refreshToken", "unknown-refresh-token"), 401)
        };
        for (var failure : failures) {
            assertContract("http/error.schema.json", failure);
        }
    }

    private JsonNode post(String path, Map<String, String> body, int expectedStatus) throws Exception {
        var request = HttpRequest.newBuilder(URI.create("http://localhost:" + port + path))
            .header("content-type", "application/json")
            .header("x-internal-service-secret", SECRET)
            .header("x-correlation-id", "iam-contract-test")
            .POST(HttpRequest.BodyPublishers.ofString(json.writeValueAsString(body)))
            .build();
        var response = http.send(request, HttpResponse.BodyHandlers.ofString());
        assertEquals(expectedStatus, response.statusCode(), response.body());
        return json.readTree(response.body());
    }

    private static void assertContract(String ref, JsonNode body) {
        var errors = SCHEMAS.getSchema(SchemaLocation.of(CONTRACTS + ref), CONFIG).validate(body);
        assertTrue(errors.isEmpty(), () -> ref + " " + errors + " in " + body);
    }
}
