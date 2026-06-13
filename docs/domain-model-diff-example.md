# Lontra Domain Model Diff (Example)

<!-- Generated from `packages/domain`. Run `just render-domain-diff` to update. -->

An example review: the changeset a planning agent might propose against Lontra's
own model, shown two ways. Each operation is classified so a reviewer's eye goes
to the breaking changes first. The graph overlays both versions — added nodes
are green, removed red, modified amber — and field and edge changes are marked
`+` (added), `-` (removed), and `~` (changed).

## Changeset

7 changes (3 breaking, 3 additive, 1 cosmetic)

### Breaking

- Retype FeatureRequest.prompt: string to RichText
- Add invariant on Artifact: An Artifact must have a Reviewer before it is Approved
- Remove Provenance.derivedFrom

### Additive

- Add ValueObject Reviewer
- Add Session.priority: Priority
- Add Artifact.reviewer: → Reviewer

### Cosmetic

- Rename Clarification to ClarificationRound

## Diagram

```mermaid
classDiagram
  direction LR
  class Session {
    <<AggregateRoot>>
    SessionId id 🔑
    FeatureRequest request
    SessionStatus status
    ClarificationRound[] clarifications
    ArtifactId[] artifacts
    PlanId? plan
    +Priority? priority
  }
  class FeatureRequest {
    <<ValueObject>>
    ~RichText prompt
    RequestSource? source
    Timestamp submittedAt
  }
  class ClarificationRound {
    <<Entity>>
    int round
    string question
    string? answer
  }
  class Plan {
    <<AggregateRoot>>
    PlanId id 🔑
    SessionId session
    ArtifactId[] artifacts
    string renderedMarkdown
  }
  class Artifact {
    <<AggregateRoot>>
    ArtifactId id 🔑
    Surface surface
    Goal goal
    Provenance provenance
    ArtifactStatus status
    +ReviewerId? reviewer
  }
  class Goal {
    <<ValueObject>>
    string statement
  }
  class Provenance {
    <<ValueObject>>
    SpecialistKind producedBy
    -ArtifactId? derivedFrom
  }
  class Changeset {
    <<ValueObject>>
    Operation[] operations
  }
  class Operation {
    <<ValueObject>>
    OperationKind kind
    StableId target
    Compatibility compat
  }
  class ArtifactChanged {
    <<DomainEvent>>
    ArtifactId artifact
  }
  class DomainModelArtifact {
    <<Entity>>
    BoundedContext[] contexts
    DomainEntity[] entities
    Relationship[] relationships
  }
  class BoundedContext {
    <<Entity>>
    ContextId id 🔑
    string name
  }
  class DomainEntity {
    <<Entity>>
    NodeId id 🔑
    string name
    NodeKind kind
    BoundedContextId context
    Field[] fields
  }
  class Field {
    <<ValueObject>>
    FieldId id 🔑
    string name
    TypeRef type
    bool optional
    FieldRole role
  }
  class Relationship {
    <<Entity>>
    EdgeId id 🔑
    DomainEntityId from
    DomainEntityId to
    EdgeKind kind
    Cardinality cardinality
  }
  class Reviewer {
    <<ValueObject>>
    +string name
  }
  Session *-- "1" FeatureRequest : request
  Session *-- "*" ClarificationRound : clarifications
  Session --> "*" Artifact : artifacts
  Session --> "0..1" Plan : plan
  Plan --> "1" Session : session
  Plan --> "*" Artifact : artifacts
  Artifact *-- "1" Goal : goal
  Artifact *-- "1" Provenance : provenance
  Artifact --> "0..1" Reviewer : + reviewer
  Changeset *-- "*" Operation : operations
  ArtifactChanged --> "1" Artifact : artifact
  Artifact <|-- DomainModelArtifact
  DomainModelArtifact *-- "*" BoundedContext : contexts
  DomainModelArtifact *-- "*" DomainEntity : entities
  DomainModelArtifact *-- "*" Relationship : relationships
  DomainEntity --> "1" BoundedContext : context
  DomainEntity *-- "*" Field : fields
  Relationship --> "1" DomainEntity : from
  Relationship --> "1" DomainEntity : to
  Provenance --> "0..1" Artifact : - derivedFrom
  classDef added fill:#e6ffed,stroke:#22863a,color:#22863a
  classDef removed fill:#ffeef0,stroke:#cb2431,color:#cb2431
  classDef modified fill:#fff5b1,stroke:#b08800,color:#735c0f
  cssClass "Reviewer" added
  cssClass "Session,FeatureRequest,ClarificationRound,Artifact,Provenance" modified
```
