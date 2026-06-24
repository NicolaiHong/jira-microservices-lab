FROM golang:1.22-alpine AS build
WORKDIR /src
COPY go.mod ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /out/notification-service .

FROM alpine:3.20 AS runtime
RUN adduser -D -H appuser
WORKDIR /app
COPY --from=build /out/notification-service ./notification-service
USER appuser
EXPOSE 8084
ENTRYPOINT ["./notification-service"]
