FROM --platform=$BUILDPLATFORM golang:1.26.5-alpine AS build

ARG TARGETARCH
ARG VERSION=dev
WORKDIR /src

COPY go.mod go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod \
    go mod download


COPY . .

ARG TARGETARCH
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 GOOS=linux GOARCH=$TARGETARCH go build \
    -trimpath \
    -ldflags="-s -w -X main.version=${VERSION}" \
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
