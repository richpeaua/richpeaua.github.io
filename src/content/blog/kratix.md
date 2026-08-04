---
title: "Kratix: Platform APIs as Kubernetes-Native Promises"
description: "How Kratix turns a platform capability into a first-class Kubernetes API: the Promise, the pipeline filesystem contract, Kratix vs. Crossplane, and nested Promises for federating a platform."
pubDate: 2026-08-01
tags: ["kratix", "kubernetes", "platform-engineering"]
featured: false
---

Kratix is a framework for building **Internal Developer Platforms** on top of Kubernetes. Its central idea is the **Promise**: a single object that turns a platform capability ("give me a Postgres database", "give me a compliant app environment") into a first-class, self-service API on the Kubernetes control plane, backed by a workflow that actually fulfills it.

This write-up synthesizes the mechanics from the ground up: how a Promise becomes an API, how workflows fulfill requests, how Promises compose across teams, and how that composition reshapes the platform org. For the tool-independent version of these arguments, see [`platform-engineering.md`](/blog/platform-engineering).

## 1. How a Promise becomes an API

A Promise is a YAML manifest with two load-bearing sections: **an API definition** and **a workflow**. The API half is what turns a Promise into a live endpoint.

Inside `.spec.api`, the platform engineer embeds a standard Kubernetes **CustomResourceDefinition (CRD)** - the same primitive Kubernetes uses for every custom type. The CRD names the new kind (e.g. `PostgreSQL`) and defines its request schema in OpenAPI v3:

```yaml
apiVersion: platform.kratix.io/v1alpha1
kind: Promise
metadata:
  name: postgres-promise
spec:
  api:
    apiVersion: apiextensions.k8s.io/v1
    kind: CustomResourceDefinition
    metadata:
      name: postgresqls.example.company.com
    spec:
      group: example.company.com
      names:
        kind: PostgreSQL
        plural: postgresqls
      versions:
        - name: v1alpha1
          served: true
          storage: true
          schema:
            openAPIV3Schema:
              type: object
              properties:
                spec:
                  type: object
                  properties:
                    storageGB:
                      type: integer
  workflows:
    # ... how the request gets fulfilled (section 2)
```

The lifecycle:

1. **Registration.** A platform engineer runs `kubectl apply -f promise.yaml`. The Kratix controller intercepts it, extracts the CRD from `.spec.api`, and submits it to the cluster's API server.
2. **Native endpoints.** Kubernetes processes the CRD and stands up REST endpoints for it - `/apis/example.company.com/v1alpha1/namespaces/{ns}/postgresqls/`. No API gateway, no custom server; the Kubernetes API machinery does this for any CRD.
3. **The developer contract.** Application developers now request the capability with an ordinary manifest, declaring *what* they want with no knowledge of *how* it's built:

   ```yaml
   apiVersion: example.company.com/v1alpha1
   kind: PostgreSQL
   metadata:
     name: my-team-db
   spec:
     storageGB: 20
   ```
4. **Validation + trigger.** On `kubectl apply`, the API server validates the request against the OpenAPI schema. If valid, Kratix detects the new custom resource and fires the Promise's workflow.

**Kratix does not build an API layer; it borrows Kubernetes'.** A Promise is a thin wrapper that registers a CRD and binds a workflow to it. Everything downstream - RBAC, `kubectl`, watches, status subresources - comes with the object model, because the request is a native Kubernetes object.

### What Kratix inherits from the Kubernetes core

Kratix is small precisely because it stands on the Kubernetes control plane and reuses its patterns wholesale rather than reinventing them. Almost every "magic" behavior below is a Kubernetes primitive Kratix simply *composes* - see [`platform-engineering.md`](/blog/platform-engineering#the-substrate-platform-patterns-borrowed-from-the-kubernetes-core) for the tool-independent treatment, and Kubernetes' own internals for the mechanisms.

| Kratix mechanic | Kubernetes primitive it reuses | KB reference |
|---|---|---|
| A Promise's `.spec.api` becomes a live REST endpoint | A **CRD** registers a type; the API server serves it | `k8s/.../crds.md` |
| Requests validated before any workflow runs | **Admission + OpenAPI schema validation** at the API hub | `k8s/.../admission-webhooks.md` |
| Kratix "detects the new request and fires the workflow" | **Level-triggered reconciliation** - a controller watching the type | `k8s/.../controllers-and-reconciliation.md` |
| `status.yaml` surfaced back into the resource's `.status` | The **`/status` subresource** (desired vs. observed, split RBAC) | `k8s/.../crds.md` |
| Who can apply/see which Promise | Native **RBAC** on the custom resource | `k8s/.../api-machinery.md` |
| `kubectl get`/`describe`/`edit` "just work" on requests | CRs are **native objects** through the same pipeline | `k8s/.../crds.md` |
| A Promise = a self-service platform capability with behavior | The **operator pattern** (CRD + controller = runbook-as-code) | `k8s/.../operators.md` |

One line to carry through the rest of this doc: **a Promise is the operator pattern generalized from "manage one workload" to "deliver one platform service," with the fulfillment step opened up to any container instead of compiled Go.** The filesystem contract, nesting, and federation are all ergonomics layered on that.

## 2. How workflows fulfill a request: the filesystem contract

A Kratix workflow is **just a sequence of containers run inside a Kubernetes Pod.** Kratix does not care whether those containers run Terraform, Helm, Pulumi, Ansible, a Python script, or a raw `curl`. If you can package a task as a Docker image, it can be a workflow step. Data moves between Kratix and your tools - and between one container and the next - through a **shared-volume filesystem contract**, four well-known paths:

```
┌─────────────────────────────────────────────────────────────┐
│  Kratix Pipeline Pod (shared volume mounted into every step) │
│                                                              │
│  /kratix/input/object.yaml   ← the dev's raw request         │
│  /kratix/metadata/           ← pass data step→step           │
│  /kratix/metadata/status.yaml← surfaced back to .status      │
│  /kratix/output/             ← final manifests → State Store │
└─────────────────────────────────────────────────────────────┘
```

- **Input - `/kratix/input/object.yaml`.** Before the first container starts, Kratix writes the developer's entire raw request YAML here. Any tool reads this file to grab its variables (`storageGB: 20`). This is the only thing a step needs to know about the request.

- **Inter-step - `/kratix/metadata/`.** For multi-step workflows (step 1 checks an API, step 2 runs Terraform, step 3 updates a CMDB), anything a container writes to this directory is preserved and handed to the next container. It carries data downstream between steps.

- **Status - `/kratix/metadata/status.yaml`.** When a step produces something the developer must see - a connection URL, a health message, a token - it writes it here. Kratix reads this file and injects it into the `.status` field of the developer's native resource, visible via ordinary `kubectl get`.

- **Output - `/kratix/output/`.** The final infrastructure manifests (a Helm `values.yaml`, a Crossplane claim, a Deployment). When the pipeline finishes, Kratix sweeps this directory, pushes the files to a **State Store** (a Git repo or S3 bucket), and a GitOps agent ([Argo CD](https://argo-cd.readthedocs.io/) or [Flux](https://fluxcd.io/)) applies them to the destination worker clusters.

This contract is the whole reason Kratix is technology-agnostic: your tools never call a Kratix SDK. They read a file, write files, exit. Kratix orchestrates the Pod around them.

## 3. Kratix vs Crossplane: orchestration vs provisioning

Kratix and Crossplane are constantly compared and are frequently confused. They solve *adjacent* problems and are often used **together**.

| | Crossplane | Kratix |
|---|---|---|
| **Primary focus** | Infrastructure provisioning & state reconciliation | Platform API design & process orchestration |
| **Execution engine** | Native Go-based providers (AWS, GCP, Azure) | Containerized pipelines (any tool in a Docker image) |
| **Abstraction level** | Low-to-medium: individual cloud resources | High: multi-step business + technical processes |
| **Tech coupling** | Couples you to Crossplane providers | Wraps Helm, Terraform, Pulumi, bash - your choice |
| **Drift handling** | Continuous reconciliation against cloud APIs (strong) | Relies on GitOps + workflow re-runs (not native) |

- **Crossplane is infrastructure-oriented.** It replaces Terraform by turning cloud resources into Kubernetes objects and running continuous reconciliation loops against cloud APIs. Excellent at drift correction and state management for a specific resource. But if fulfilling a request means registering an API key in a third-party system, updating a CMDB, sending a Slack alert, *and* running a migration - doing that natively means writing a custom Go provider or wrestling complex Compositions.

- **Kratix is workflow-oriented.** It doesn't care how infrastructure gets built; it owns the *contract* and the *process*. A Promise wraps your existing tools as a sequence of containers. The trade-off: Kratix leans on external engines and GitOps for the heavy lifting and does not natively manage drift the way Crossplane does.

**Better together** is the common production pattern: Kratix owns the user-facing contract and the multi-step business workflow; its pipeline emits Crossplane manifests into `/kratix/output/`; Crossplane provisions and continuously reconciles the actual cloud resources. Kratix does the orchestration, Crossplane does the state management.

## 4. Multi-vertical pipelines: solving the silo problem

A Promise's workflow can chain multiple containers, and each can be **owned by a different team**. The canonical example is an "Enterprise Application Environment" Promise where one developer request flows through four domain-owned stages:

```
[ Dev API Request ]
       │
       ▼
 ┌───────────┐    ┌──────────────┐    ┌────────────┐    ┌───────────────┐
 │ 1. INFRA  │───>│ 2. SECURITY  │───>│ 3. COMPLI  │───>│ 4. OPERATIONS │
 │ (Terraform│    │ (Vault role /│    │ (FinOps /  │    │ (GitOps repo /│
 │  manifest)│    │  image scan) │    │  CMDB reg) │    │  Argo sync)   │
 └───────────┘    └──────────────┘    └────────────┘    └───────────────┘
   Platform Ops      InfoSec           Governance          SRE
```

Each stage is a Pipeline in `spec.workflows.resource.configure`, running in sequence. The infra step outputs baseline manifests to `/kratix/output/`; the security step *reads those files, injects Vault sidecars, and writes them back*; compliance appends cost-allocation labels and registers the environment in ServiceNow; operations sends the Slack "environment is online" alert.

Why this defeats the silo problem:

- **Loose coupling.** The security team never learns how infra provisions anything. They write a small utility, package it as `security/vault-injector:v1.1`, and it mutates whatever files sit in `/kratix/output/`. The contract between teams is *the files on disk*, not shared code.
- **Native audit trail.** Each vertical runs as a sequential Kubernetes Pod, so you get cluster-level logging for free. If compliance fails because a team ID doesn't exist, the pipeline *halts before shipping anything* to the GitOps repo.
- **Uniform dev experience.** Developers never know these steps exist. They submit a 10-line request and the enterprise transparently achieves compliance, alerting, and secure delivery.

## 5. Nested Promises: federating the platform

Chaining containers in one giant Promise still implies one team assembling the pipeline. The advanced pattern - **Nested Promises / Promise Chaining** - removes even that coupling. Instead of embedding other teams' containers, the master Promise **emits requests to other teams' own Promise APIs.**

```
[ App Developer Request ]
          │
          ▼
┌───────────────────────────┐
│ Master App Promise        │  (Orchestrator)
└─────────────┬─────────────┘
              │ (outputs a custom resource per vertical)
              ├───────────────────────────────┐
              ▼                               ▼
┌───────────────────────────┐   ┌───────────────────────────┐
│ Security Promise          │   │ Compliance Promise        │
│ kind: VaultIdentity       │   │ kind: CMDBRegistration    │
│ (owned by InfoSec)        │   │ (owned by Finance)        │
└───────────────────────────┘   └───────────────────────────┘
```

How it works:

1. **InfoSec publishes their own Promise** exposing a `VaultIdentity` API (asks for `teamName`, `accessLevel`). Its workflow hits the real Vault API, builds policies, and writes credentials to `/kratix/output/`. They own this entirely in their own Git repo.
2. **The master Promise consumes that API.** The platform team no longer writes Vault logic. Their master pipeline simply writes a `VaultIdentity` manifest to `/kratix/output/security-request.yaml`:
   ```yaml
   apiVersion: security.corp.com/v1alpha1
   kind: VaultIdentity
   metadata:
     name: dev-team-alpha-vault-access
   spec:
     teamName: alpha-billing
     accessLevel: restricted
   ```
3. **Kratix coordinates the handoff.** When the master pipeline finishes, Kratix applies that `VaultIdentity` to the API server. InfoSec's independent Kratix controller wakes up, sees the new request, and runs *their* pipeline. The status flows back up into the master resource.

Each vertical now behaves like an **internal SaaS vendor**. The benefits are the ones that only appear at enterprise scale:

- **Isolated release lifecycles.** InfoSec upgrades their Vault engine from v5 to v6 and deploys instantly. The master pipeline is untouched.
- **True service reuse.** The data or networking team can call the `VaultIdentity` API directly, bypassing the master app pipeline entirely.
- **RBAC-enforced guardrails.** Native Kubernetes RBAC restricts who can alter which Promise. Platform has cluster-wide access; InfoSec holds exclusive write over the `security.corp.com` API group.
- **Decentralized debugging.** A failure in the security phase is localized to the security container's logs. Platform engineers never sift through security code.

## 6. What this does to the platform team

Nested Promises transform the central team from a **bottleneck into an enabler** - the org-level shift covered in depth in [`platform-engineering.md`](/blog/platform-engineering). In Kratix terms specifically:

| Old (Platform-as-a-Queue) | New (Federated Promises) |
|---|---|
| InfoSec files a Jira ticket to add Vault sidecars to the deploy engine. | InfoSec builds a container, tests it locally, releases a new version of their own Promise. |
| Platform spends 3 days debugging a DBA team's broken Terraform module. | The DBA team owns the database Promise. Platform only helps if Kratix fails to *schedule* the Pod. |
| Platform is a ticket queue that slows releases. | Platform are product managers who scale the ecosystem without scaling headcount. |

The central team stops writing Promise *logic* and focuses on the substrate: inter-Promise contracts and schemas, the multi-cluster mesh and state stores, golden-path templates and base images for building Promises, and the developer portal (e.g. [Backstage](https://backstage.io/)) where every team's Promise appears as one unified menu.

The cultural name for the endpoint: moving from **Submission** (the platform team is responsible for everything, has authority over nothing) to **Federation** (authority and responsibility align - the team that writes the logic owns the outcome). The platform team becomes the **ecosystem architect** that makes the independent pieces fit together.

## Recap

A **Promise** is a CRD (the API contract) plus a container workflow (the fulfillment), stitched into Kubernetes so requests are native objects. Workflows talk to Kratix through four filesystem paths, which is why any tool works. Promises **chain** (one workflow, many containers) and **nest** (one Promise emits requests to other teams' Promise APIs), and nesting is what lets each domain team own its slice as an internal SaaS. What Kratix ultimately produces is less the infrastructure than the operating model: the platform team owns contracts and substrate, and every vertical owns its own logic.
