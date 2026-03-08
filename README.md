# WS Workspace

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)

## About

WS Workspace is an AI-powered desktop application for connecting and working across multiple data sources. Built on [Craft Agents](https://github.com/lukilabs/craft-agents-oss) v0.6.0.

## Features

- **Multi-Source Integration** - Connect to Linear, GitHub, Slack, custom APIs, and local filesystems through MCP servers
- **Automated Workflows** - Combine data from multiple sources to create powerful automated workflows
- **Code Execution** - Full Python and Bash support for data manipulation and task automation
- **Beautiful UI** - Modern, fluid interface built with React and Electron

## Key Capabilities

- **MCP Server Support** - Connect external data sources through the Model Context Protocol
- **REST API Integration** - Work with any API endpoint or service
- **Local Development** - Full filesystem access and terminal operations
- **Skills System** - Reusable instruction sets for specialized behaviors
- **Project Context** - CLAUDE.md and AGENTS.md support for project-specific conventions

## Technology Stack

- **Runtime**: Electron + Bun
- **Frontend**: React + Vite + TailwindCSS
- **Backend**: Claude Agent SDK + Pi SDK
- **Architecture**: Monorepo with pnpm workspaces

## Development

```bash
# Install dependencies
bun install

# Run in development mode
bun run electron:dev

# Build for production
bun run electron:build

# Create installer
bun run electron:dist
```

## Project Structure

```
├── apps/
│   ├── electron/     # Desktop application
│   └── viewer/       # Session viewer
├── packages/
│   ├── core/         # Core agent logic
│   ├── shared/       # Shared utilities
│   ├── ui/           # React UI components
│   └── ...
└── sources/
    └── browser-agent/ # Browser automation MCP server
```

## Upstream

This project is a fork of [Craft Agents OSS](https://github.com/lukilabs/craft-agents-oss) by Luki Labs / Craft Docs Ltd.

**Current upstream version**: v0.6.0

## License

Apache 2.0 - See [LICENSE](LICENSE) for details.

## Credits

Built by [WS Agency](https://wsagency.dev) based on Craft Agents by Luki Labs.

---

**Co-Authored-By**: WS Workspace <noreply@wsagency.dev>
