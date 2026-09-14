# k2.jf

A public submodule for the k2/jf Job Fair framework, providing a browser-based testing interface and WebSocket integration for distributed job processing.

## Overview

**k2.jf** is a web-based testing environment for the Job Fair (jF) framework—a distributed system that matches job requests from clients (like browsers) with Job Agents offering services. This repository serves as the public-facing component for the k2 project, enabling secure, message-signed job execution with mTLS support.

## Key Features

- **Browser-Based Job Testing**: Interactive web interface for testing job requests and agent matching
- **Distributed Job Matching**: Client requests are matched with available Job Agents
- **Message Authentication**: All messages are cryptographically signed by senders and verified by recipients
- **WebSocket Integration**: Uses WebSocket connections for real-time client-agent communication
- **mTLS Support**: Job Agents in QA environments use mutual TLS for enhanced security
- **State Management**: Implements the State and Context design patterns for managing connection attachments

## Architecture

### Core Components

1. **bjft-hbs.html** - Basic Job Fair Test interface
   - HTML test page describing the job matching workflow
   - Demonstrates two-phase job request processing
   - Explains the handshake protocol between clients and agents

2. **shim.js** - Buffer polyfill module
   - Provides Node.js-compatible Buffer API for browser environments
   - Essential for cryptographic message signing and verification

3. **style.css** - Styling for the test interface
   - Monospace font styling
   - Smooth scrolling behavior
   - Text alignment utilities

4. **lib/** - TypeScript library code
   - Core implementation of the Job Fair client logic
   - Connection and state management

5. **tsconfig.json** - TypeScript configuration
   - ES2022 target
   - Node.js module resolution
   - Configured to process TypeScript files in the `lib/` directory

## How It Works

### Basic Job Fair Test Flow

1. **Part 1 - Initial Job Processing**:
   - Two Job Agents connect to jF, each offering echo jobs
   - Browser sends first job request
   - One agent is matched; handshake negotiation occurs
   - If successful, the echo job is executed
   - Second agent remains available
   - Browser sends second job request; matched with second agent

2. **Part 2 - Deferred Job Processing**:
   - Browser sends a third job request that hangs temporarily
   - Both Job Agents reconnect to jF
   - One agent is matched and executes the job
   - Browser sends final job request; matched with remaining agent

### Message Security

- All messages are digitally signed by the sender
- Verification occurs at the network edge and by recipients
- Essential for ensuring authenticated communication in distributed environments

### Connection Model

Each participant (Job Agent or Job Client) maintains:
- An open WebSocket connection to the network edge
- An associated attachment containing State and Context objects
- Breakpoint management following the [State Pattern](https://en.wikipedia.org/wiki/State_pattern)

## Technology Stack

- **Language**: TypeScript
- **Runtime**: Node.js (ES2022)
- **Transport**: WebSocket
- **Security**: mTLS, Message Signing
- **Frontend**: HTML5, CSS3

## Getting Started

### Prerequisites

- Node.js environment
- TypeScript support
- Browser with WebSocket support

### Development

1. Clone the repository
2. Review the TypeScript configuration in `tsconfig.json`
3. Examine the test interface in `bjft-hbs.html`
4. Implement or extend TypeScript modules in the `lib/` directory

### Testing

Open `bjft-hbs.html` in a browser to run the Basic Job Fair Test. The interface will guide you through:
- Submitting job requests
- Observing agent matching behavior
- Verifying signed message authentication
- Testing the complete job lifecycle

## Project Context

This repository is a **submodule** of the larger k2 project and represents the public-facing interface for the Job Fair framework. It provides:

- Testing and demonstration capabilities
- Reference implementation for browser-based Job Clients
- Example WebSocket integration patterns
- Security best practices for distributed job processing

## Related Resources

- [State Pattern - Wikipedia](https://en.wikipedia.org/wiki/State_pattern)
- Job Fair (jF) Framework Documentation
- k2 Project Documentation

## License

See the main k2 project for licensing information.

## Contributing

Contributions are welcome. Please ensure:
- TypeScript code follows the `tsconfig.json` configuration
- Messages are properly signed and verified
- WebSocket connections maintain proper state management
- mTLS is enforced for production Job Agents

---

**Repository**: [didalik/k2.jf](https://github.com/didalik/k2.jf)  
**Type**: Public Submodule  
**Language**: TypeScript  
**Last Updated**: 2026-09-14
