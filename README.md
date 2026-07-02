# Auditive CMS

A minimalist React CMS for developers who think in Markdown. Ship pages fast, manage content visually, skip the bloat.

## 🔗 Live Demo

[https://auditive.tokyo/](https://auditive.tokyo/)

## ✨ Features

### Content Management

- **Markdown & HTML Support** — Write content in Markdown or use HTML tags (`<h>`, `<a>`, `<iframe>`, `<div>`, `<span>`)
- **Live Preview** — See your changes in real-time before publishing
- **Draft/Publish Workflow** — Save drafts and publish when ready

### Menu System

- **Drag & Drop Reordering** — Easily reorganize menu items
- **Parent/Child Menus** — Create hierarchical navigation structures
- **Default Page Selection** — Set any page as your homepage

### Security & Authentication

- **AWS Cognito** — Secure authentication with Identity Pool
- **IAM-based API Access** — Public read access without API key expiration concerns

### Admin Access

Access the admin login page at `/#fxxking-login`

## 🛠 Tech Stack

| Layer    | Technology                              |
| -------- | --------------------------------------- |
| Frontend | React 18, TypeScript, Vite              |
| Styling  | Tailwind CSS, @tailwindcss/typography   |
| Backend  | AWS AppSync (GraphQL), DynamoDB, Lambda |
| Auth     | AWS Cognito Identity Pool (IAM)         |
| Hosting  | GitHub Pages                            |
| CI/CD    | GitHub Actions, CloudFormation          |

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- AWS Account

### Installation

```bash
# Fork this repository, then clone your fork
git clone https://github.com/yourusername/auditive.git
cd auditive

# Install dependencies
npm install

# Start development server
npm run dev
```

### GitHub Secrets

The following secrets are required for CI/CD pipeline:

| Secret                  | Description                                  |
| ----------------------- | -------------------------------------------- |
| `AWS_ACCESS_KEY_ID`     | AWS access key for deployment                |
| `AWS_SECRET_ACCESS_KEY` | AWS secret access key                        |
| `AWS_REGION`            | AWS region (e.g., `ap-northeast-1`)          |
| `ADMIN_PASSWORD`        | Password for admin page access               |
| `CONTACT_FORM_EMAIL`    | Email address for contact form notifications |
| `ZOHO_APP_PASSWORD`     | Zoho SMTP app password                       |

> **Note:** AWS resources (AppSync, DynamoDB, Cognito, Lambda, etc.) are automatically provisioned via CloudFormation/SAM when the CI/CD pipeline runs.

## 🎨 Creating Content

### Markdown Example

```markdown
## Section Title

This is a paragraph with **bold** and _italic_ text.

- List item 1
- List item 2

[Link text](https://example.com)
```

### HTML Example

```html
<div style="background: #1a1a1a; padding: 20px; border-radius: 8px;">
  <iframe
    src="https://w.soundcloud.com/player/..."
    width="100%"
    height="166"
  ></iframe>
</div>
```
