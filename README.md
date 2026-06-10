# 3DGabro

**3DGabro** is an open-source experimental platform for conversational 3D design, engineering metadata, and manufacturing-aware CAD workflows.

The main idea is simple:

**A person may not know CAD, but they know what they want.**

3DGabro is designed to act like a CAD operator: the user describes a part in natural language, points to geometry on the screen, asks questions, requests changes, and receives a structured 3D model, drawing, or manufacturing-ready file.

This project explores how natural language, mouse interaction, assistant guidance, parametric CAD, 3D model libraries, engineering metadata, and local manufacturing services can work together in one system.

---

## Vision

Today, many people have practical engineering ideas but cannot express them as CAD drawings.

In real workshops, a non-CAD user often stands behind a CAD operator and says things like:

* “Make this hole larger.”
* “Show me the top view.”
* “Move this part a little to the left.”
* “I need a bracket like this, but longer.”
* “Can this be laser cut and bent instead of machined?”
* “Show me which one you mean.”
* “No, not that hole — the lower left one.”

3DGabro tries to automate this human CAD operator workflow.

The goal is not only to draw geometry, but to help the user think, compare, modify, validate, and prepare a part for real manufacturing.

---

## Core Concept

3DGabro is based on several connected ideas:

### 1. Conversational CAD Operator

The system should understand natural language instructions and convert them into formal CAD actions.

The user should be able to say:

> “Make this bracket 20% longer.”

or:

> “Increase this hole to 10 mm.”

The assistant should understand the intent, ask clarification if needed, show what it means, and then apply the change.

---

### 2. Shared Action Model

Humans and the assistant must use the same internal action language.

A button click, a mouse action, a mobile voice command, and an assistant command should all become the same kind of structured action.

Example:

```json
{
  "actor": "assistant",
  "action": "set_parameter",
  "target": "Hole_03",
  "parameter": "diameter",
  "value": 10,
  "unit": "mm"
}
```

This makes the system easier to extend, debug, replay, log, undo, and automate.

---

### 3. Two-Pointer Collaboration

The user has a mouse pointer.

The assistant should also have a virtual pointer.

This allows natural coordination:

* “Show me which hole you mean.”
* “This one?”
* “No, the lower left one.”
* “Apply the same change to all similar holes.”

The assistant should not only speak. It should be able to point, highlight, preview, and explain.

---

### 4. Desktop for Drawing, Mobile for Conversation

A useful workflow may use two screens:

* the desktop screen shows a clean WebGL/CAD workspace;
* the mobile phone handles voice, chat, confirmation, and assistant replies.

The large screen stays focused on the model.

The phone becomes a voice control and dialogue terminal.

---

### 5. Engineering Feature Graph

A 3D model should not be only a mesh.

It should contain structured engineering meaning:

* planes;
* holes;
* slots;
* bosses;
* ribs;
* fillets;
* chamfers;
* mounting faces;
* connection points;
* patterns;
* symmetry;
* functional roles;
* manufacturing constraints.

This metadata allows the assistant to understand, search, modify, validate, and explain the model.

---

### 6. Manufacturing-Aware Design

3DGabro should not only draw what the user asks.

It should also suggest better ways to manufacture the part.

For example, if a user asks for a machined bracket, the assistant may suggest:

* laser cut + bending;
* CNC machining;
* 3D printing;
* welded fabrication;
* sheet metal design.

The system should compare alternatives and explain why one process may be cheaper, stronger, faster, or easier.

---

### 7. Metadata-Based 3D Library

3DGabro should support a searchable library of reusable 3D models.

The user may say:

> “I need a bracket.”

The system should show existing brackets from the library.

Then the user may say:

> “This one, but a little longer.”

The system should modify the parametric model, update drawings, and preserve engineering constraints.

Search should work by:

* functional name;
* geometry;
* parameters;
* manufacturing method;
* material;
* connection points;
* use case;
* metadata.

---

### 8. Validation and Warnings

The assistant should not blindly accept unsafe or weak designs.

If the user creates a risky part, the system should warn them and show better examples.

For example:

* hole too close to edge;
* wall too thin for 3D printing;
* plastic part used for high load;
* unsupported overhang;
* unclear material;
* missing mounting clearance.

Warnings should be stored inside the model metadata.

Example:

```json
{
  "severity": "warning",
  "category": "structural_risk",
  "feature": "Hook_01",
  "message": "Thin plastic hook specified for high load. Strength not verified."
}
```

The user may still experiment, but the model should clearly show that a risk was identified.

---

## 3DGabro CORE: Voxel-Based Reconstruction Research

3DGabro also includes a research direction called **3DGabro CORE**.

This module explores how raw meshes and point clouds can be converted into structured engineering metadata.

The goal is to move from raw geometric data toward understandable engineering features.

Possible pipeline:

```text
point cloud / mesh
↓
normalization
↓
voxel or octree partitioning
↓
primitive detection
↓
feature recognition
↓
engineering metadata
↓
CAD reconstruction
```

The earlier research direction included:

* spatial normalization of OBJ inputs;
* reversible transformation matrices;
* recursive voxel partitioning;
* density-based feature detection;
* semantic highlighting;
* future neural or algorithmic primitive recognition.

This remains part of the long-term scan-to-CAD vision of the project.

---

## Current Prototype

The first prototype is a simple WebGL interface.

It currently demonstrates:

* a clean isometric 3D viewport;
* a simple plate with holes;
* mouse-based hole selection;
* basic measurement display;
* simple command input;
* parameter editing, such as changing hole diameter.

This prototype is not a full CAD kernel.

Its purpose is to test the interaction model:

```text
user points
↓
user speaks or types
↓
assistant/action system interprets
↓
model updates
```

---

## Planned Architecture

```text
Human input
  - text
  - voice
  - mouse
  - mobile controls

Assistant layer
  - clarification
  - pointing
  - suggestions
  - warnings
  - CAD action generation

Shared Action Bus
  - all changes pass through one action model

Model State
  - parametric geometry
  - features
  - metadata
  - warnings
  - history

Renderer
  - WebGL / Three.js viewport

CAD / Geometry Backend
  - parametric generation
  - boolean operations
  - DXF / STEP / STL export

Engineering Library
  - reusable models
  - templates
  - metadata
  - manufacturing rules
```

---

## Possible Outputs

3DGabro aims to support:

* WebGL preview;
* STL for 3D printing;
* DXF for laser cutting;
* STEP for CAD/CAM workflows;
* PDF technical drawings;
* flat patterns for sheet metal;
* manufacturing notes;
* warning reports;
* metadata files;
* reusable parametric templates.

---

## Long-Term Goal

The long-term goal is to make engineering design more accessible.

Just as video publishing became accessible to everyone through online platforms, practical 3D design and small-scale manufacturing should become accessible to people who do not know traditional CAD.

A user should be able to:

1. describe what they need;
2. select or modify an existing model;
3. receive suggestions and warnings;
4. generate a valid drawing or 3D file;
5. send it to a local 3D printing, laser cutting, CNC, or sheet metal workshop.

3DGabro is an attempt to build the interface, metadata, and workflow for that future.

---

## Project Philosophy

Traditional CAD asks:

> “Which tool do you want to use?”

3DGabro asks:

> “What are you trying to make?”

The system should help translate human intent into geometry, engineering metadata, manufacturing decisions, and useful technical files.

---

## Status

**Experimental / early prototype**

The project is currently in the conceptual and early prototyping phase.

Current focus:

* WebGL interaction prototype;
* shared action model;
* conversational CAD workflow;
* engineering metadata structure;
* assistant pointer concept;
* metadata-based 3D library design;
* scan-to-CAD research through 3DGabro CORE.

---

## License

This project is intended as an open-source research and prototyping effort.

License details will be defined as the repository structure becomes stable.

---

## 3DGabro

**Conversational CAD Operator.
Engineering Metadata Library.
Manufacturing-Aware 3D Design Ecosystem.**
