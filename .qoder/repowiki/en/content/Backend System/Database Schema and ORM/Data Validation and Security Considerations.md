# Data Validation and Security Considerations

<cite>
**Referenced Files in This Document**
- [schema.prisma](file://packages/backend/prisma/schema.prisma)
- [package.json](file://packages/backend/package.json)
- [project-service.ts](file://packages/backend/src/services/project-service.ts)
- [project-repository.ts](file://packages/backend/src/repositories/project-repository.ts)
- [auth-service.ts](file://packages/backend/src/services/auth-service.ts)
- [auth.ts](file://packages/backend/src/plugins/auth.ts)
- [ownership-repository.ts](file://packages/backend/src/repositories/ownership-repository.ts)
- [project-aspect.ts](file://packages/backend/src/lib/project-aspect.ts)
- [prisma.ts](file://packages/backend/src/lib/prisma.ts)
- [README.md](file://README.md)
</cite>

## Table of Contents

1. [Introduction](#introduction)
2. [Project Structure](#project-structure)
3. [Core Components](#core-components)
4. [Architecture Overview](#architecture-overview)
5. [Detailed Component Analysis](#detailed-component-analysis)
6. [Dependency Analysis](#dependency-analysis)
7. [Performance Considerations](#performance-considerations)
8. [Troubleshooting Guide](#troubleshooting-guide)
9. [Conclusion](#conclusion)
10. [Appendices](#appendices)

## Introduction

This document provides comprehensive data validation and security guidance for the Prisma schema implementation in the backend. It focuses on:

- Field-level validation rules and data type constraints
- Input sanitization and normalization patterns
- Soft delete patterns using deletedAt fields
- Audit trail implementation and data lifecycle management
- Security considerations including SQL injection prevention, data masking, and access control patterns
- Enum usage for status fields, array constraints for tags and styles, and JSON field validation
- Data export/import procedures, backup strategies, and disaster recovery considerations
- GDPR compliance, data retention policies, and user data portability

## Project Structure

The backend uses Prisma with PostgreSQL and Fastify. The Prisma schema defines the data model, while services and repositories encapsulate validation, normalization, and access control. Authentication is handled via JWT, enforced by a Fastify plugin, and ownership checks are performed against the database.

```mermaid
graph TB
subgraph "Backend"
PRISMA["Prisma Client"]
SCHEMA["Prisma Schema<br/>models, enums, relations"]
REPO["Repositories<br/>typed database access"]
SVC["Services<br/>validation, normalization, orchestration"]
AUTH["Auth Plugin<br/>JWT verification + ownership checks"]
end
SCHEMA --> PRISMA
PRISMA --> REPO
REPO --> SVC
AUTH --> SVC
AUTH --> REPO
```

**Diagram sources**

- [schema.prisma:1-430](file://packages/backend/prisma/schema.prisma#L1-L430)
- [prisma.ts:1-4](file://packages/backend/src/lib/prisma.ts#L1-L4)
- [auth.ts:1-107](file://packages/backend/src/plugins/auth.ts#L1-L107)

**Section sources**

- [README.md:13-26](file://README.md#L13-L26)
- [schema.prisma:1-430](file://packages/backend/prisma/schema.prisma#L1-L430)
- [package.json:22-38](file://packages/backend/package.json#L22-L38)

## Core Components

- Prisma schema: Defines models, fields, relations, indexes, defaults, and enums. It enforces data types and constraints at the database level.
- Services: Apply business validation, normalize inputs, and enforce domain rules before delegating to repositories.
- Repositories: Encapsulate Prisma queries and handle ownership checks and soft-deleted filtering.
- Auth plugin: Enforces JWT-based authentication and verifies resource ownership across models.

Key validation and security mechanisms observed:

- Field defaults and non-nullability in the schema
- Array fields with default empty arrays
- JSON fields with unvalidated content
- Enum fields for controlled status values
- Soft delete pattern via deletedAt on Location
- Ownership checks for all CRUD operations

**Section sources**

- [schema.prisma:10-430](file://packages/backend/prisma/schema.prisma#L10-L430)
- [project-service.ts:14-319](file://packages/backend/src/services/project-service.ts#L14-L319)
- [project-repository.ts:1-160](file://packages/backend/src/repositories/project-repository.ts#L1-L160)
- [auth.ts:12-107](file://packages/backend/src/plugins/auth.ts#L12-L107)

## Architecture Overview

The system separates concerns across schema, repositories, services, and plugins. Validation occurs at multiple layers:

- Database constraints (schema)
- Service-level normalization and validation
- Plugin-level authentication and authorization
- Ownership repository queries that filter soft-deleted rows

```mermaid
sequenceDiagram
participant Client as "Client"
participant Route as "Route Handler"
participant Svc as "Service"
participant Repo as "Repository"
participant DB as "PostgreSQL"
Client->>Route : "HTTP Request"
Route->>Svc : "Invoke operation with body"
Svc->>Svc : "Validate + Normalize inputs"
Svc->>Repo : "Persist or query"
Repo->>DB : "Prisma query"
DB-->>Repo : "Result"
Repo-->>Svc : "Domain object"
Svc-->>Route : "Response"
Route-->>Client : "HTTP Response"
```

**Diagram sources**

- [project-service.ts:51-319](file://packages/backend/src/services/project-service.ts#L51-L319)
- [project-repository.ts:5-160](file://packages/backend/src/repositories/project-repository.ts#L5-L160)
- [schema.prisma:28-53](file://packages/backend/prisma/schema.prisma#L28-L53)

## Detailed Component Analysis

### Data Types, Constraints, and Defaults

- Scalars: String, Int, Float, Boolean, DateTime, Json
- Arrays: String[] defaults to empty arrays for visualStyle, characters, tags, mood, relatedIds, embedding
- JSON: Used for structured payloads (e.g., script, voiceConfig, metadata, progressMeta)
- Enums: Status fields use enums (e.g., Project, Episode, Scene, Take, Composition, PipelineJob)
- Indexes: Composite and single-column indexes for performance and uniqueness
- Defaults: createdAt defaults to now(), updatedAt tracks changes, cuid() for primary keys

Validation and normalization patterns:

- Aspect ratio normalization to a fixed set of allowed values
- Array validation in services before persistence
- JSON content validation and sanitization in services

**Section sources**

- [schema.prisma:10-430](file://packages/backend/prisma/schema.prisma#L10-L430)
- [project-aspect.ts:1-28](file://packages/backend/src/lib/project-aspect.ts#L1-L28)
- [project-service.ts:274-309](file://packages/backend/src/services/project-service.ts#L274-L309)

### Field-Level Validation Rules

- Project.visualStyle: Must be a string array; validated in service update
- Project.aspectRatio: Must be a string; normalized to allowed values
- Episode.script: JSON; validated as object with scenes array in service
- Scene.voiceConfig, ModelApiCall.responseData, MemoryItem.metadata: JSON; validated in service
- Location.deletedAt: Soft delete marker; repository excludes deleted rows by default

```mermaid
flowchart TD
Start(["Service Input"]) --> CheckArray["Validate Array Fields"]
CheckArray --> CheckString["Validate String Fields"]
CheckString --> Normalize["Normalize Values"]
Normalize --> ValidateJSON["Validate JSON Content"]
ValidateJSON --> Persist["Persist via Repository"]
Persist --> End(["Success"])
```

**Diagram sources**

- [project-service.ts:274-309](file://packages/backend/src/services/project-service.ts#L274-L309)
- [project-repository.ts:65-70](file://packages/backend/src/repositories/project-repository.ts#L65-L70)

**Section sources**

- [project-service.ts:274-309](file://packages/backend/src/services/project-service.ts#L274-L309)
- [project-repository.ts:65-70](file://packages/backend/src/repositories/project-repository.ts#L65-L70)

### Soft Delete Pattern Using deletedAt

- Location model includes deletedAt DateTime? for soft deletion
- Ownership repository excludes deleted rows by default in queries
- Project detail retrieval filters locations by deletedAt = null

```mermaid
flowchart TD
SoftDelete["Set deletedAt = now()"] --> Filter["Repository filters by deletedAt IS NULL"]
Filter --> List["List excludes soft-deleted rows"]
Filter --> Detail["Detail excludes soft-deleted rows"]
```

**Diagram sources**

- [schema.prisma:194-214](file://packages/backend/prisma/schema.prisma#L194-L214)
- [ownership-repository.ts:66-74](file://packages/backend/src/repositories/ownership-repository.ts#L66-L74)
- [project-repository.ts:59-62](file://packages/backend/src/repositories/project-repository.ts#L59-L62)

**Section sources**

- [schema.prisma:194-214](file://packages/backend/prisma/schema.prisma#L194-L214)
- [ownership-repository.ts:66-74](file://packages/backend/src/repositories/ownership-repository.ts#L66-L74)
- [project-repository.ts:59-62](file://packages/backend/src/repositories/project-repository.ts#L59-L62)

### Audit Trail Implementation

- createdAt and updatedAt fields present on most models
- ModelApiCall records per AI call include timestamps and status
- PipelineJob and PipelineStepResult track job progress and errors with timestamps

Recommendations:

- Add explicit audit log entries for sensitive operations
- Consider storing diffs for updates where applicable
- Enforce immutable identifiers for referential integrity

**Section sources**

- [schema.prisma:240-263](file://packages/backend/prisma/schema.prisma#L240-L263)
- [schema.prisma:314-346](file://packages/backend/prisma/schema.prisma#L314-L346)

### Data Lifecycle Management

- Deletion: Projects are deleted via repository; cascading deletes propagate to dependent entities
- Soft deletion: Locations support soft deletion via deletedAt
- Archival: Consider snapshotting memory content periodically

```mermaid
stateDiagram-v2
[*] --> Active
Active --> SoftDeleted : "Set deletedAt"
SoftDeleted --> Active : "Unset deletedAt"
Active --> Deleted : "Cascade delete"
```

**Diagram sources**

- [schema.prisma:194-214](file://packages/backend/prisma/schema.prisma#L194-L214)
- [project-repository.ts:72-74](file://packages/backend/src/repositories/project-repository.ts#L72-L74)

**Section sources**

- [schema.prisma:28-53](file://packages/backend/prisma/schema.prisma#L28-L53)
- [schema.prisma:194-214](file://packages/backend/prisma/schema.prisma#L194-L214)
- [project-repository.ts:72-74](file://packages/backend/src/repositories/project-repository.ts#L72-L74)

### Security Considerations

#### SQL Injection Prevention

- All database access goes through Prisma client; queries are strongly typed
- No raw SQL string concatenation observed in the analyzed files
- Use Prisma’s parameterized queries and avoid dynamic query building

```mermaid
sequenceDiagram
participant Route as "Route"
participant Svc as "Service"
participant Repo as "Repository"
participant Prisma as "Prisma Client"
participant DB as "PostgreSQL"
Route->>Svc : "Call with validated params"
Svc->>Repo : "Typed Prisma call"
Repo->>Prisma : "Prisma query"
Prisma->>DB : "Parameterized SQL"
DB-->>Prisma : "Result"
Prisma-->>Repo : "Result"
Repo-->>Svc : "Result"
Svc-->>Route : "Response"
```

**Diagram sources**

- [prisma.ts:1-4](file://packages/backend/src/lib/prisma.ts#L1-L4)
- [project-repository.ts:5-160](file://packages/backend/src/repositories/project-repository.ts#L5-L160)

**Section sources**

- [prisma.ts:1-4](file://packages/backend/src/lib/prisma.ts#L1-L4)
- [project-repository.ts:5-160](file://packages/backend/src/repositories/project-repository.ts#L5-L160)

#### Data Masking

- Passwords are hashed before storage; plaintext passwords are never persisted
- API keys and secrets are stored as strings; consider encrypting at rest and limiting exposure in logs

**Section sources**

- [auth-service.ts:14-40](file://packages/backend/src/services/auth-service.ts#L14-L40)
- [schema.prisma:10-26](file://packages/backend/prisma/schema.prisma#L10-L26)

#### Access Control Patterns

- JWT-based authentication enforced by a Fastify plugin
- Ownership checks for all resources via dedicated helpers
- Repository queries filter out unauthorized or soft-deleted rows

```mermaid
sequenceDiagram
participant Client as "Client"
participant Auth as "Auth Plugin"
participant Repo as "OwnershipRepository"
participant DB as "PostgreSQL"
Client->>Auth : "Request with JWT"
Auth->>Auth : "jwtVerify()"
Auth->>Repo : "verifyOwnership(userId, resourceId)"
Repo->>DB : "Lookup project/user relation"
DB-->>Repo : "Result"
Repo-->>Auth : "Boolean"
Auth-->>Client : "Allow or 401"
```

**Diagram sources**

- [auth.ts:12-107](file://packages/backend/src/plugins/auth.ts#L12-L107)
- [ownership-repository.ts:10-114](file://packages/backend/src/repositories/ownership-repository.ts#L10-L114)

**Section sources**

- [auth.ts:12-107](file://packages/backend/src/plugins/auth.ts#L12-L107)
- [ownership-repository.ts:10-114](file://packages/backend/src/repositories/ownership-repository.ts#L10-L114)

### Enum Usage for Status Fields

Enums constrain status values to predefined sets across models:

- Project.status: Not explicitly defined in schema; likely application-controlled
- Episode.status: Not explicitly defined in schema; likely application-controlled
- Scene.status: Not explicitly defined in schema; likely application-controlled
- Take.status: Enum-like string with default value
- Composition.status: Enum-like string with default value
- PipelineJob.status: Enum-like string with default value

Recommendations:

- Define enums for status fields in the schema to enforce at DB level
- Use Zod or similar for runtime validation in services

**Section sources**

- [schema.prisma:265-281](file://packages/backend/prisma/schema.prisma#L265-L281)
- [schema.prisma:314-330](file://packages/backend/prisma/schema.prisma#L314-L330)

### Array Constraints for Tags and Styles

- visualStyle: String[] default []
- characters: String[] default [] (Location)
- tags: String[] default [] (ProjectAsset)
- mood: String[] default [] (ProjectAsset)
- relatedIds: String[] default [] (MemoryItem)
- embedding: Float[] default [] (MemoryItem)

Validation:

- Services validate that visualStyle is an array and sanitize content as needed

**Section sources**

- [schema.prisma:38-40](file://packages/backend/prisma/schema.prisma#L38-L40)
- [schema.prisma:199-201](file://packages/backend/prisma/schema.prisma#L199-L201)
- [schema.prisma:356-358](file://packages/backend/prisma/schema.prisma#L356-L358)
- [schema.prisma:395-396](file://packages/backend/prisma/schema.prisma#L395-L396)
- [schema.prisma:392-392](file://packages/backend/prisma/schema.prisma#L392-L392)
- [project-service.ts:290-295](file://packages/backend/src/services/project-service.ts#L290-L295)

### JSON Field Validation

- JSON fields include script, voiceConfig, metadata, progressMeta, contextJson
- Services validate JSON content shapes and sanitize inputs before persistence
- Consider adding JSON schema validation and sanitization libraries

Examples of validation observed:

- Episode.script must be an object containing scenes array
- Scene.voiceConfig must be a valid JSON object
- MemoryItem.metadata must be a valid JSON object

**Section sources**

- [schema.prisma:62-62](file://packages/backend/prisma/schema.prisma#L62-L62)
- [schema.prisma:81-81](file://packages/backend/prisma/schema.prisma#L81-L81)
- [schema.prisma:389-389](file://packages/backend/prisma/schema.prisma#L389-L389)
- [schema.prisma:338-339](file://packages/backend/prisma/schema.prisma#L338-L339)
- [schema.prisma:423-423](file://packages/backend/prisma/schema.prisma#L423-L423)
- [project-service.ts:196-200](file://packages/backend/src/services/project-service.ts#L196-L200)
- [project-service.ts:28-32](file://packages/backend/src/services/project-service.ts#L28-L32)

### Data Export/Import Procedures

- Composition export: CompositionService orchestrates export workflow
- ImportTask: Supports importing content with type and result JSON
- Consider implementing standardized import/export formats (e.g., JSON) with schema validation

```mermaid
sequenceDiagram
participant Client as "Client"
participant CompSvc as "CompositionService"
participant Export as "Export Workflow"
participant Storage as "Object Storage"
Client->>CompSvc : "Export composition"
CompSvc->>Export : "Run export pipeline"
Export->>Storage : "Upload media assets"
Storage-->>Export : "URLs"
Export-->>CompSvc : "Export result"
CompSvc-->>Client : "Export status + URLs"
```

**Diagram sources**

- [composition-service.ts:69-71](file://packages/backend/src/services/composition-service.ts#L69-L71)

**Section sources**

- [composition-service.ts:69-71](file://packages/backend/src/services/composition-service.ts#L69-L71)
- [schema.prisma:298-312](file://packages/backend/prisma/schema.prisma#L298-L312)

### Backup Strategies and Disaster Recovery

- Use Prisma migrations for schema changes
- PostgreSQL backups should be integrated with Docker Compose deployment
- Consider point-in-time recovery and regular snapshots
- Maintain separate environments for development, staging, and production

[No sources needed since this section provides general guidance]

### GDPR Compliance, Data Retention, and Portability

- Data minimization: Only collect necessary fields (e.g., aspectRatio normalization)
- Retention: Implement data retention policies for logs and temporary data
- Portability: Provide APIs to export user data (names, emails, project assets, compositions)
- Right to erasure: Implement cascading deletions and secure data destruction

[No sources needed since this section provides general guidance]

## Dependency Analysis

The backend depends on Prisma for ORM and Fastify for HTTP. Authentication and authorization are centralized in a plugin with ownership checks delegated to repositories.

```mermaid
graph LR
Fastify["Fastify"] --> Auth["Auth Plugin"]
Auth --> Ownership["OwnershipRepository"]
Ownership --> Prisma["Prisma Client"]
Prisma --> Schema["Prisma Schema"]
Services["Services"] --> Repositories["Repositories"]
Repositories --> Prisma
```

**Diagram sources**

- [auth.ts:12-107](file://packages/backend/src/plugins/auth.ts#L12-L107)
- [ownership-repository.ts:1-118](file://packages/backend/src/repositories/ownership-repository.ts#L1-L118)
- [prisma.ts:1-4](file://packages/backend/src/lib/prisma.ts#L1-L4)
- [schema.prisma:1-430](file://packages/backend/prisma/schema.prisma#L1-L430)

**Section sources**

- [auth.ts:12-107](file://packages/backend/src/plugins/auth.ts#L12-L107)
- [ownership-repository.ts:1-118](file://packages/backend/src/repositories/ownership-repository.ts#L1-L118)
- [prisma.ts:1-4](file://packages/backend/src/lib/prisma.ts#L1-L4)
- [schema.prisma:1-430](file://packages/backend/prisma/schema.prisma#L1-L430)

## Performance Considerations

- Use indexes strategically (composite and single-column) as defined in the schema
- Prefer selective queries with where clauses and projections
- Batch operations where feasible (e.g., bulk memory creation)
- Monitor long-running jobs and avoid blocking requests

[No sources needed since this section provides general guidance]

## Troubleshooting Guide

Common issues and resolutions:

- Unauthorized access: Verify JWT token and ownership checks
- Validation errors: Ensure arrays and strings meet service expectations
- JSON parsing errors: Validate JSON shape before persistence
- Soft-deleted rows missing: Confirm repository filters exclude deletedAt

**Section sources**

- [auth.ts:12-35](file://packages/backend/src/plugins/auth.ts#L12-L35)
- [project-service.ts:274-309](file://packages/backend/src/services/project-service.ts#L274-L309)
- [project-repository.ts:59-62](file://packages/backend/src/repositories/project-repository.ts#L59-L62)

## Conclusion

The Prisma schema establishes strong foundational constraints, while services and repositories implement robust validation and normalization. Authentication and ownership checks provide layered security. To further strengthen the system, define enums for status fields, add JSON schema validation, implement explicit audit logging, and establish formal backup and GDPR-compliant data lifecycle policies.

[No sources needed since this section summarizes without analyzing specific files]

## Appendices

### Appendix A: Data Model Overview

```mermaid
erDiagram
USER {
string id PK
string email UK
string name
string password
string apiKey
string deepseekApiUrl
string atlasApiKey
string atlasApiUrl
string arkApiKey
string arkApiUrl
datetime createdAt
datetime updatedAt
}
PROJECT {
string id PK
string name
string description
string synopsis
text storyContext
string aspectRatio
string userId FK
datetime createdAt
datetime updatedAt
}
EPISODE {
string id PK
string projectId FK
int episodeNum
string title
string synopsis
json script
datetime createdAt
datetime updatedAt
}
CHARACTER {
string id PK
string projectId FK
string name
string description
string voiceId
json voiceConfig
datetime createdAt
datetime updatedAt
}
CHARACTER_IMAGE {
string id PK
string characterId FK
string name
string prompt
string avatarUrl
float imageCost
string parentId FK
string type
string description
int order
datetime createdAt
datetime updatedAt
}
LOCATION {
string id PK
string projectId FK
string name
string timeOfDay
string[] characters
string description
string imagePrompt
string imageUrl
float imageCost
datetime deletedAt
datetime createdAt
datetime updatedAt
}
SCENE {
string id PK
string episodeId FK
int sceneNum
string locationId FK
string timeOfDay
string description
int duration
string aspectRatio
string[] visualStyle
json seedanceParams
string status
datetime createdAt
datetime updatedAt
}
SHOT {
string id PK
string sceneId FK
int shotNum
int order
string description
int duration
string cameraMovement
string cameraAngle
datetime createdAt
datetime updatedAt
}
CHARACTER_SHOT {
string id PK
string shotId FK
string characterImageId FK
string action
datetime createdAt
datetime updatedAt
}
SCENE_DIALOGUE {
string id PK
string sceneId FK
string characterId FK
int order
int startTimeMs
int durationMs
string text
json voiceConfig
string emotion
datetime createdAt
datetime updatedAt
}
TAKE {
string id PK
string sceneId FK
string model
string externalTaskId
string status
string prompt
float cost
int duration
string videoUrl
string thumbnailUrl
string errorMsg
boolean isSelected
datetime createdAt
datetime updatedAt
}
MODEL_API_CALL {
string id PK
string userId FK
string model
string provider
string prompt
string requestParams
string externalTaskId
string status
string responseData
float cost
int duration
string errorMsg
string takeId FK
datetime createdAt
datetime updatedAt
}
COMPOSITION {
string id PK
string projectId FK
string episodeId FK
string title
string status
string outputUrl
datetime createdAt
datetime updatedAt
}
COMPOSITION_SCENE {
string id PK
string compositionId FK
string sceneId FK
string takeId FK
int order
}
IMPORT_TASK {
string id PK
string projectId FK
string userId FK
string status
string content
string type
json result
string errorMsg
datetime createdAt
datetime updatedAt
}
PIPELINE_JOB {
string id PK
string projectId FK
string status
string jobType
string currentStep
int progress
json progressMeta
string error
datetime createdAt
datetime updatedAt
}
PIPELINE_STEP_RESULT {
string id PK
string jobId FK
string step
string status
json input
json output
string error
datetime createdAt
datetime updatedAt
}
PROJECT_ASSET {
string id PK
string projectId FK
string type
string name
string url
string description
string[] tags
string[] mood
string location
string source
datetime createdAt
datetime updatedAt
}
MEMORY_ITEM {
string id PK
string projectId FK
enum type
string category
string title
text content
json metadata
float[] embedding
string[] relatedIds
string episodeId FK
string[] tags
int importance
boolean isActive
boolean verified
datetime createdAt
datetime updatedAt
}
MEMORY_SNAPSHOT {
string id PK
string projectId FK
datetime snapshotAt
int upToEpisode
text summary
json contextJson
datetime createdAt
}
USER ||--o{ PROJECT : "owns"
PROJECT ||--o{ EPISODE : "contains"
PROJECT ||--o{ CHARACTER : "contains"
PROJECT ||--o{ LOCATION : "contains"
PROJECT ||--o{ COMPOSITION : "contains"
PROJECT ||--o{ IMPORT_TASK : "has"
PROJECT ||--o{ PIPELINE_JOB : "has"
PROJECT ||--o{ PROJECT_ASSET : "has"
PROJECT ||--o{ MEMORY_ITEM : "has"
PROJECT ||--o{ MEMORY_SNAPSHOT : "has"
EPISODE ||--o{ SCENE : "contains"
CHARACTER ||--o{ CHARACTER_IMAGE : "has"
LOCATION ||--o{ SCENE : "hosts"
SCENE ||--o{ SHOT : "contains"
SHOT ||--o{ CHARACTER_SHOT : "has"
CHARACTER ||--o{ SCENE_DIALOGUE : "speaks_in"
SCENE ||--o{ SCENE_DIALOGUE : "has"
SCENE ||--o{ TAKE : "generates"
TAKE ||--o{ MODEL_API_CALL : "logs"
COMPOSITION ||--o{ COMPOSITION_SCENE : "assembles"
EPISODE ||--o{ COMPOSITION : "produces"
PIPELINE_JOB ||--o{ PIPELINE_STEP_RESULT : "produces"
```

**Diagram sources**

- [schema.prisma:10-430](file://packages/backend/prisma/schema.prisma#L10-L430)
