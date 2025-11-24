# Claude Instructions

This file contains instructions and context for Claude to reference during development.

## Project Context

This is the Multi-Perspective AI application for Wellcoaches School.

### Architecture
- **Frontend**: React application
- **Backend**: Node.js/Express API
- **Database**: DynamoDB
- **Hosting**: AWS Elastic Beanstalk
- **CDN**: CloudFront
- **Authentication**: AWS Cognito
- **Email**: AWS SES

### Key Features
- AI-powered coaching conversations with multiple perspectives
- Conversation history and management
- PDF and Word document download of conversations
- User authentication and profile management

## Current Work

### Keap AWS Payment Integration
Working on integrating Keap payments with AWS infrastructure. This involves:
- Setting up payment processing through Keap
- Connecting payment events to user account management
- Integrating with existing AWS Cognito authentication system

## Development Guidelines

### AWS Services
- Use AWS CLI commands when needed for infrastructure checks
- Follow AWS best practices for security and scalability
- Keep credentials and sensitive data in environment variables

### Code Standards
- Use clear, descriptive variable and function names
- Add comments only where logic isn't self-evident
- Avoid over-engineering - keep solutions simple and focused
- Don't add features beyond what's requested

### Git Workflow
- Main branch: `main`
- Create descriptive commit messages
- Include "🤖 Generated with [Claude Code](https://claude.com/claude-code)" in commits
- Don't push to remote unless explicitly requested

## Notes

- Recent features added: PDF/Word download, conversation history improvements
- Focus on maintaining existing architecture patterns
- Check git status before major changes
