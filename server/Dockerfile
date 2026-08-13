FROM golang:1.26.5-alpine AS build

WORKDIR /src

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build \
    -trimpath \
    -ldflags="-s -w" \
    -o /out/neurosync-api \
    ./cmd/api

FROM alpine:3.22 AS runtime

RUN apk add --no-cache ca-certificates \
    && addgroup -S neurosync \
    && adduser -S -G neurosync neurosync

COPY --from=build /out/neurosync-api /usr/local/bin/neurosync-api

USER neurosync

EXPOSE 8080

ENTRYPOINT ["neurosync-api"]
