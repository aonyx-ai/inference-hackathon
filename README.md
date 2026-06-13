# Inference Hackathon

_A better interface for scoping work for autonomous coding agents._

We are participating in [Whale]'s [Inference Hackathon], which explores the
following idea:

> If you have unlimited compute, what autonomous agent system would you build?

Our hypothesis is that coding harnesses like Claude Code will keep improving at
a great pace, getting better and better at handling complex tasks autonomously.
This enables developers to shift their focus left: scope work and set goals, and
then hand off the work to coding agents.

We strongly believe that the current interfaces between developers and agents
are fundamentally unsuitable for such a world. As agents deliver more work more
quickly, scoping that work becomes the bottleneck. Passing a GitHub Issue to
Claude and then reviewing an 800 line `plan.md` doesn't cut it anymore...

## A Better Interface

When passing a task to our tool, agents start analyzing it and exploring the
codebase. They ask clarifying questions until they fully understand the user's
goal and the code.

Then, they describe the required changes across three different surfaces:

1. **Architecture**: What changes to the application's architecture are
   required?
2. **Domain Model**: How does the change touch the domain model?
3. **User Experience**: Does the change require changes to the application's
   user interface or experience?

The findings are presented as easy-to-parse artifacts that match the surface
area. Changes to the UI are surfaced as wireframes or high-fidelity mocks,
changes to the architecture and domain model as diffable graphs.

## Planning Process

```mermaid
sequenceDiagram
    actor User
    User->>+Orchestrator: Prompt
    Note over Orchestrator: Analyze task and explore codebase
    loop Until the goal is clear
        Orchestrator->>User: Ask clarifying questions
        User->>Orchestrator: Answer
    end
    par Architecture
        Orchestrator->>+Architecture Agent: Plan
        Architecture Agent-->>-Orchestrator: Artifact
    and Domain Model
        Orchestrator->>+Domain Model Agent: Plan
        Domain Model Agent-->>-Orchestrator: Artifact
    and User Experience
        Orchestrator->>+UX Agent: Plan
        UX Agent-->>-Orchestrator: Artifact
    end
    Orchestrator->>User: Present plan
    User->>Orchestrator: Approve
    Orchestrator->>-Coding Agent: Pass plan
```

[inference hackathon]: https://luma.com/whale-t8hg
[whale]: https://www.whale-academy.com/
