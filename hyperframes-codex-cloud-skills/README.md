# HyperFrames skills for Codex Cloud

This portable Markdown bundle contains the HyperFrames skill set used to plan, build, inspect, preview and render deterministic HTML-to-video compositions.

## Contents

- `hyperframes/` — primary video workflow, composition contract, launch/explainer/etc. guidance, motion and review references.
- `hyperframes-cli/` — CLI commands for scaffolding, checking, snapshots, previews, rendering and project history.
- `hyperframes-registry/` — discover and install editable effects, transitions, components and blocks before recreating a known visual.
- `media-use/` — source, use and process media, sound, cutouts, treatments and local assets.

Each folder keeps its original `SKILL.md` entrypoint and `references/` Markdown hierarchy. Give Codex Cloud the complete folder, then instruct it to read the relevant `SKILL.md` before it edits a video project and the linked reference documents before it runs a matching command.

These instructions assume the target environment has the HyperFrames CLI available through `npx hyperframes` (or the project-provided wrapper), Node.js 22+ and FFmpeg when rendering locally.
