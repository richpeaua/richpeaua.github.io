---
title: "From Ticket Queue to Federated Product"
description: "Why central platform teams collapse at scale, the shift from platform-as-a-queue to a federated product, and the Kubernetes control-plane patterns any platform is built on."
pubDate: 2026-07-20
tags: ["platform-engineering", "kubernetes", "developer-experience"]
featured: true
---

Notes on the platform-engineering operating model, drawn out from a close read of [Kratix](/blog/kratix) but not specific to it. The same shifts show up with Crossplane Compositions, Backstage software templates, Terraform module registries, or a hand-rolled internal platform. Kratix is a convenient lens because it makes the model easy to see.

## The problem platform engineering exists to solve

Every growing engineering org hits the same wall. Application developers want to *declare an outcome* ("I need a Postgres database", "I need a preview environment") and get it. Instead they inherit the full implementation surface: Terraform modules, IAM roles, network policy, secret wiring, compliance tagging, cost-center attribution. The knowledge required to ship one feature balloons into the knowledge required to operate the whole platform.

The naive fix is a **central platform team** that absorbs this complexity on everyone's behalf. That team becomes the single place where infrastructure, security, compliance, and networking logic all live. It works at 20 engineers. It collapses at 200.

The reason it collapses is structural, not a staffing problem, and it is the thread that runs through everything below.

## The core failure mode: responsibility without authority

In the centralized model the platform team is **responsible for everything but has authority over nothing**.

- They can't tell InfoSec how to do security - but they get paged when the Vault sidecar breaks.
- They didn't write the DBA team's SQL migration - but they spend three days debugging it when the pipeline fails.
- They own the delivery system, so every domain team's work flows *through* them as a submission.

This is the **Platform-as-a-Queue** model. Verticals (security, compliance, networking, data) hand off scripts, Helm charts, and guidelines via Jira tickets and PRs. The central team integrates, tests, and maintains code it doesn't understand. The team becomes a bottleneck that is simultaneously blamed for slowness and structurally prevented from going faster - adding headcount just adds more people debugging other teams' logic.

The fix is not a better queue. It is to **realign authority and responsibility** so the team that writes a domain's logic is the team accountable for it.

## The shift: three ways to name the same move

The same reorganization gets three names depending on which facet you emphasize:

| Facet | Old | New |
|---|---|---|
| **Interaction model** | Submission (hand work to the platform team) | Collaboration / self-service |
| **Ownership** | Centralized (one team owns all logic) | Federated / domain ownership |
| **Team identity** | Ticket-taking queue | Platform product managers |

The through-line: the platform team stops *writing domain logic* and starts *providing the substrate on which domain teams write their own*. The mall analogy is the cleanest: the platform team builds and runs the mall (power, plumbing, foot traffic, the directory); each vertical builds and runs its own storefront. The mall operator does not stock the shelves.

```
 ┌────────────────────────────────────────────────────────┐
 │           CENTRAL PLATFORM TEAM (Horizontal)           │
 │  - Core clusters / compute      - The API framework     │
 │  - GitOps / state stores        - Integration consulting│
 │  - Golden paths & templates     - The developer portal  │
 └──────┬───────────────────┬───────────────────┬─────────┘
        │ (enables)         │ (enables)         │ (enables)
        ▼                   ▼                   ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│ SECURITY TEAM │   │ COMPLIANCE TM │   │ NETWORKING TM │
│ (owns logic)  │   │ (owns logic)  │   │ (owns logic)  │
└───────────────┘   └───────────────┘   └───────────────┘
```

## What the platform team actually does after the shift

When verticals own their logic, the central team is not smaller - it is *pointed at a different layer*. Its job becomes **integration and governance**, four concrete responsibilities:

1. **Inter-team API contracts and schemas.** If the security service needs a `team-id`, the infra service must collect and emit that exact field in a standard shape. The platform team are the API architects for the company's internal service marketplace - they define how data passes *between* domains, not what happens *inside* one.

2. **The delivery substrate.** The clusters, the GitOps repositories, the state stores, the multi-cluster scheduling. When a vertical ships a new version of its service, the platform makes sure that change propagates reliably to every edge and cloud cluster.

3. **Golden paths and templates.** The easiest way to get a vertical to own its logic is to make owning it cheap. Boilerplate repos, standard base images, ready-made CI pipelines. A new team should plug in *their* logic, not reinvent the scaffolding.

4. **The developer-facing catalog.** A single discoverable interface (an internal developer portal - [Backstage](https://backstage.io/) is the common choice) where every independently-owned service shows up as one coherent menu. Developers should not need to know that five different teams back the five things they can request.

This is the essence of an **Internal Developer Platform (IDP)**: a unified self-service surface over a federated set of independently-owned capabilities.

## The technical primitive that makes federation possible: the API contract

Federation only works if teams can integrate without reading each other's code. That requires a hard boundary - a **contract** - between "what I request" and "how it's fulfilled." Three properties make a contract strong enough to federate on:

- **Declarative request.** The consumer states the desired outcome (`storageGB: 20`), never the procedure. This is the same level-triggered, declarative principle that underpins Kubernetes itself: you assert the setpoint, a controller drives reality toward it.
- **Schema validation.** The request is checked against a published schema *at submission time*, so malformed asks fail fast and loudly at the boundary, not deep inside someone's pipeline.
- **Opaque fulfillment.** The producer can swap Terraform for Pulumi, change cloud regions, or rewrite the whole implementation. As long as the contract holds, no consumer notices or needs to.

When each vertical publishes such a contract, one team can *consume* another team's capability by emitting a request object - no shared library, no coordinated deploy, no cross-team code review. That decoupling is what lets a platform scale to many teams without a linear growth in cross-team friction.

## The substrate: platform patterns borrowed from the Kubernetes core

Most platform toolchains - Kratix, [Crossplane](https://www.crossplane.io/), Backstage-on-Kubernetes, the operator ecosystem - build on Kubernetes. The reason that matters is not container orchestration. It is that Kubernetes is a **general-purpose declarative control plane**: a well-worn implementation of the patterns a self-service, self-healing, policy-governed platform needs. Orchestrating containers is one application of that control plane; a platform is another. The patterns below are the transferable parts - the `k8s/` knowledge base in this repo documents each at the mechanism level, linked inline.

### 1. Declarative and level-triggered reconciliation

Consumers record **desired state** (`spec`); independent **controllers** continuously drive **observed state** (`status`) toward it. The loop is *level-triggered*, not *edge-triggered*: a controller reacts to the current state of the world, not to the event that got there. Miss ten events to a crash or a network partition and it does not matter - on restart the controller re-lists reality and reconciles again. (`k8s/03-internals/controllers-and-reconciliation.md`)

An imperative platform ("run these steps to create the database") is only ever as correct as its last run, and breaks the moment a step is missed. A reconciling platform re-derives correctness on every pass. That is the deeper reason a live platform API beats a one-shot pipeline (see the section below), and the reason drift correction, retries, and Day-2 operations come with the model instead of being bolted on after.

### 2. One hub, one contract surface

Every request in a Kubernetes cluster flows through a single component - the API server - and *nothing* talks to any other component directly, or to the datastore except through it. That hub is the **only** place authentication, authorization, admission, and schema validation happen. (`k8s/01-architecture/cluster-architecture.md`, `k8s/03-internals/api-machinery.md`)

Two consequences are what a federated platform needs:

- **Uniform policy enforcement.** Every request - from a human, a CI pipeline, or another team's controller - passes the same gates. Enforce a rule once, at the hub, and it holds everywhere. No per-integration policy drift.
- **Decoupling by default.** Components only need to know how to reach the hub, never each other. This is the substrate under [federation](#the-shift-three-ways-to-name-the-same-move): teams integrate through one API plane, not N brittle point-to-point connections.

The lesson for a platform: avoid per-team custom integration surfaces. Put every capability behind one contract-bearing API plane so policy and discovery have a single home.

### 3. Type vs. behavior: the contract is decoupled from its fulfillment

Adding a new capability to Kubernetes is two separable acts. A **CustomResourceDefinition (CRD)** registers a new API type - schema, validation, REST endpoints, RBAC, `kubectl` support - all for free, purely by describing the *contract*. A **controller** then supplies the *behavior* that makes instances of that type do something. **CRD = the type; controller = the behavior.** A CRD with no controller is just validated, typed storage. (`k8s/04-advanced-development/crds/crds.md`)

This is the API contract of the previous section, made mechanical:

- A team can publish a stable **schema** while rewriting the **fulfillment** behind it at will - the "opaque fulfillment" property, enforced by the platform rather than promised in a wiki.
- The **operator pattern** (CRD + controller) encodes operational knowledge that would otherwise live in a human's runbook: safe rollout order, backoff on failure, cleanup on delete, status that reflects reality. A platform capability is an operator by another name - a runbook turned into a program that keeps running. (`k8s/04-advanced-development/operators/operators.md`)

### 4. Splitting the request from the reported state

Objects carry desired state in `spec` and observed reality in `status`, and the two sit behind separate REST endpoints with **separate RBAC**: a controller can be granted permission to report status without being able to alter desired state, and a consumer who writes the request cannot forge its status. (the `/status` subresource)

For a platform this is one uniform, tamper-resistant channel for surfacing reality back to consumers - a generated connection string, a health condition, a "still provisioning" phase - read the same way for every capability. Kratix does this with its `status.yaml`; see [`kratix.md`](/blog/kratix).

### 5. Guardrails as a pluggable pipeline stage, not scattered code

Before any write is persisted, it passes through an **admission** pipeline: mutating stages that can inject defaults, then schema validation, then validating stages that accept or reject. These run at the hub, uniformly, as composable plugins - built-in policies, in-process CEL rules, or out-of-process webhooks. (`k8s/04-advanced-development/admission-webhooks/admission-webhooks.md`)

This is a stronger idea than "shift-left." Shift-left puts checks in each team's pipeline, where they can be skipped, drift apart, and get re-implemented per repo. Admission **moves policy to the control plane**: the guardrail lives once, at the boundary every request must cross, and cannot be dodged by choosing a different pipeline. Compliance and safety rules belong here, at the contract boundary as composable stages, not scattered through fulfillment logic. The same caution carries over: a mandatory guardrail that is down can block the very requests it governs, so its failure mode is part of the design.

### 6. Lifecycle machinery: ownership and cleanup

The substrate also handles the tedious Day-2 mechanics. **Owner references** record which object owns which, so garbage collection cascades a delete through the whole tree on its own. **Finalizers** block a deletion until cleanup logic has actually run - the object lingers with a `deletionTimestamp` until its external resources are torn down. (owner refs & finalizers, CRD finalizers)

Model ownership correctly and "delete the environment" reclaims every downstream resource, in order, without leaking cloud resources because some teardown script forgot a step.

### Applying the patterns

A platform team building on Kubernetes inherits all of this rather than rebuilding it. The work is to recognize these as the patterns doing the heavy lifting and to keep them intact in whatever sits on top: assert desired state and reconcile; route everything through one contract-bearing plane; keep the schema separable from its fulfillment; report state through one status channel; enforce guardrails at the boundary; model ownership so cleanup follows. Much of what Kratix adds is ergonomics for applying these patterns to whole platform services instead of individual workloads.

## Why a live API beats a shift-left check

A large class of platform problems cannot be solved by CI/CD or "shift-left" scanning, and understanding why explains what a platform is *for*.

This is the [level-triggered reconciliation pattern](#1-declarative-and-level-triggered-reconciliation) in operational terms. **CI/CD is point-in-time (edge-triggered) validation.** It runs once, during a PR or a deploy, and proves the manifest was correct at that instant. A platform API, backed by a control plane, is a **long-lived, active (level-triggered) process** that stays alive for the resource's whole lifecycle, re-checking reality against the contract. That difference decides four recurring scenarios:

1. **Runtime credential lifecycles.** A scanner can catch a hardcoded secret. It cannot *rotate* one. Short-lived tokens expire hours after the deploy finishes; only a long-lived controller can mint, mount, and rotate them on a schedule.

2. **On-demand infrastructure with a real contract.** A GitOps-triggered Terraform run makes a developer write a module, open a PR, wait, and grep raw logs for a connection string. A live API lets them declare the need and receive the connection string back as a native secret, immediately mountable.

3. **Drift detection and auto-remediation.** A scanner proves a resource *was* compliant at merge time. It cannot stop an admin from changing a firewall rule in the console three weeks later. A reconciling controller runs continuously, detects the drift, and overwrites it - the check *outlives the pipeline*.

4. **Day-2 lifecycle operations.** Pipelines are good at Day-1 creation and bad at Day-2: pausing a database, running a live schema migration, hibernating an environment over the weekend to save cost, tearing down cleanly in the right order. These need a stateful API you can call again and again against a long-lived resource, not a pipeline you re-run from scratch.

The common thread: **anything that needs continuous enforcement, state synchronization, or lifecycle management is beyond what a point-in-time check can do.** That work is what a platform owns.

## Organizational anti-patterns to watch for

- **The re-centralization drift.** Under pressure ("just do it for us, we don't have time to learn the framework"), verticals push logic back onto the platform team, and the queue silently reforms. Golden paths and low onboarding friction are the countermeasure - if owning a service is expensive, teams will refuse to.
- **Contract sprawl without governance.** Federation without an API-architecture function produces N incompatible schemas and a marketplace no one can navigate. Someone must own the *contracts between* services even when no one owns the logic *inside* them.
- **The portal as afterthought.** A dozen well-built, independently-owned services with no unified catalog is, from the developer's seat, indistinguishable from chaos. Discovery is a first-class platform feature, not decoration.

## In short

Platform engineering at scale is the move from being the team that does the work to being the team that makes it cheap for every other team to do their own work - safely, behind stable contracts, discoverable in one place. Aligning authority with responsibility is what makes the org side work. The [Kubernetes-core patterns](#the-substrate-platform-patterns-borrowed-from-the-kubernetes-core) - declarative reconciliation, one contract hub, type/behavior separation, admission guardrails, lifecycle machinery - are what make the substrate work. Tools like Kratix, Crossplane, and Backstage package the two together.

---

*See [Kratix: Platform APIs as Kubernetes-Native Promises](/blog/kratix) for how one specific tool implements these ideas, and [Building a Platform, Layer by Layer](/blog/building-a-platform) for a hands-on, tool-by-tool build guide.*
