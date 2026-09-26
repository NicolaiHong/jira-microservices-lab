package com.example.iam.presentation.common;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import io.micrometer.common.KeyValue;
import org.junit.jupiter.api.Test;
import org.springframework.http.server.observation.ServerRequestObservationContext;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

class CorrelationIdObservationFilterTest {
    @Test
    void tagsTheServerSpanWithTheRequestCorrelationId() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setAttribute(CorrelationIdContext.RequestAttribute, "req_123");
        var context = new ServerRequestObservationContext(request, new MockHttpServletResponse());

        new CorrelationIdObservationFilter().map(context);

        assertEquals(
            KeyValue.of("app.correlation_id", "req_123"),
            context.getHighCardinalityKeyValue("app.correlation_id")
        );
    }

    @Test
    void leavesRequestsWithoutCorrelationIdUntagged() {
        var context = new ServerRequestObservationContext(
            new MockHttpServletRequest(), new MockHttpServletResponse());

        new CorrelationIdObservationFilter().map(context);

        assertNull(context.getHighCardinalityKeyValue("app.correlation_id"));
    }
}
