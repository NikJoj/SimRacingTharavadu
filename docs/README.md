# API documentation

[openapi.yaml](openapi.yaml) is the Swagger-compatible OpenAPI 3.0.3 contract for the handlers registered by `api/index.js`. Import it into Swagger Editor or an existing Swagger UI. The default server uses the same origin as the hosted spec; select the local server for Azure Functions development.

## Keeping it current

Update the specification in the same change as an API route, request parameter, response field, authentication rule, or status code. Document the actual handler behavior, including conditional action bodies, nullable values, and partial failures. Database-only migrations and backfills do not automatically create API fields or endpoints.

Run `node --test api/tests/openapi.test.js` from the repository root. This dependency-free check compares the specification's paths and HTTP methods with the modules imported by `api/index.js`, and checks operation IDs. It does not validate payload schemas or all YAML syntax; also validate the file with an OpenAPI 3.0 validator or Swagger Editor when editing schemas.

Driver requests use the HttpOnly cookie created by the website's Discord login flow. For protected admin operations, Swagger's Authorize control takes the raw `X-SRT-Admin-Token` issued by `/api/login-auth`. The spec identifies the operations that currently enforce authentication.

The specification describes available HTTP behavior, not planned driver ratings or insights. The historical LMU import and remaining identity work are recorded in [lmu-results-backfill.md](lmu-results-backfill.md).
