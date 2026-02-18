# QA Wizard — AI Testing Automation

## Overview

QA Wizard is an AI-powered testing automation platform that streamlines the entire QA lifecycle — from fetching JIRA requirements to generating specifications, test scenarios, test code, executing tests, and reviewing results. It uses Google Vertex AI (Gemini) as the LLM backbone and integrates directly with JIRA and MongoDB for seamless workflow management.

The platform provides two main flows:

- **New Requirement Flow** — Start from a JIRA ticket → Generate spec → Generate test scenarios
- **Test Existing Requirement Flow** — Generate test code → Execute tests → AI-powered review

## Technologies

| Layer | Technology |
|---|---|
| **Backend** | FastAPI (Python) |
| **Frontend** | Vanilla HTML / CSS / JavaScript |
| **AI / LLM** | Google Vertex AI — Gemini (via `vertexai` and `google-cloud-aiplatform`) |
| **Database** | MongoDB (via `motor` async driver + `pymongo`) |
| **JIRA Integration** | JIRA REST API (via `requests`) |
| **Test Execution** | Playwright, Cypress, or Jest (configurable) |

## Project Structure

```
testing-automation-main/
├── backend/
│   ├── app/
│   │   ├── agents/              # AI agents for each workflow step
│   │   │   ├── spec_interpreter.py
│   │   │   ├── scenario_generator.py
│   │   │   ├── test_code_generator.py
│   │   │   └── test_reviewer.py
│   │   ├── api/                 # FastAPI routes and dependencies
│   │   │   ├── routes.py
│   │   │   └── dependencies.py
│   │   ├── config/              # App settings and database config
│   │   │   ├── settings.py
│   │   │   └── database.py
│   │   ├── models/              # Pydantic models and schemas
│   │   │   ├── requirements.py
│   │   │   └── schemas.py
│   │   ├── services/            # Core services
│   │   │   ├── jira_service.py
│   │   │   ├── llm_service.py
│   │   │   ├── test_executor.py
│   │   │   └── file_handler.py
│   │   └── main.py              # FastAPI application entry point
│   ├── requirements.txt
│   └── run.py                   # Server start script
├── frontend/
│   ├── index.html               # Homepage
│   ├── css/                     # Stylesheets for each page
│   ├── js/                      # JavaScript logic for each page
│   └── pages/                   # HTML pages for each workflow step
│       ├── jira-input.html
│       ├── spec-generation.html
│       ├── test-scenarios.html
│       ├── test-code.html
│       ├── test-execution.html
│       └── test-review.html
├── test.py                      # Standalone JIRA epic child finder utility
├── .gitignore
└── README.md
```

## Prerequisites

- **Python 3.8 or higher** (3.10+ recommended)
- **pip** package manager
- **Git** (for cloning repository)
- **MongoDB** installed and running locally (default: `mongodb://localhost:27017`)
- **Google Cloud Vertex AI** access with a service account JSON file
- **JIRA** account and API token for JIRA integration
- **(Optional)** Node.js and npm — required if executing Playwright, Cypress, or Jest tests

## Usage

### 1. Clone the repository

```bash
git clone <your-repository-url>
cd testing-automation-main
```

### 2. Create and activate a virtual environment (recommended)

```bash
# Windows
python -m venv .venv
.\.venv\Scripts\activate

# Linux / macOS
python -m venv .venv
source .venv/bin/activate
```

### 3. Install required packages

```bash
cd backend
pip install -r requirements.txt
```

### 4. Configure environment variables

Create a `.env` file inside the `backend/` directory with the following variables:

```env
# JIRA Configuration
JIRA_BASE_URL=https://your-domain.atlassian.net/
JIRA_EMAIL=your-email@example.com
JIRA_API_TOKEN=your-jira-api-token

# MongoDB Configuration
MONGO_URI=mongodb://localhost:27017
MONGO_DB_NAME=testing_automation

# Google Vertex AI / Gemini Configuration
GOOGLE_CLOUD_PROJECT=your-gcp-project-id
GOOGLE_APPLICATION_CREDENTIALS=path/to/your-service-account.json
VERTEX_AI_LOCATION=us-central1
GEMINI_MODEL_NAME=gemini-2.5-pro
```

| Variable | Description |
|---|---|
| `JIRA_BASE_URL` | Base URL of your Jira instance (e.g., `https://your-domain.atlassian.net/`) |
| `JIRA_EMAIL` | Email of the Jira user used for API authentication |
| `JIRA_API_TOKEN` | JIRA API token (generate from Atlassian account settings) |
| `MONGO_URI` | MongoDB connection URI (default: `mongodb://localhost:27017`) |
| `MONGO_DB_NAME` | MongoDB database name (default: `testing_automation`) |
| `GOOGLE_CLOUD_PROJECT` | Google Cloud project ID with Vertex AI enabled |
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to Google Cloud service account JSON key file |
| `VERTEX_AI_LOCATION` | Vertex AI region (default: `us-central1`) |
| `GEMINI_MODEL_NAME` | Gemini model to use (default: `gemini-2.5-pro`) |

### 5. Start the application

```bash
cd backend
python run.py
```

The FastAPI server will start on `http://localhost:8000` and automatically open the frontend in your browser.

### 6. Use the application

1. Open `http://localhost:8000` in your browser.
2. Choose a workflow:
   - **New Requirement Flow** — Enter a JIRA ticket ID to generate specifications and test scenarios.
   - **Test Existing Requirement** — Generate test code, execute tests, and review results for a ticket that already has specs and scenarios.
3. Follow the step-by-step wizard through the workflow.

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Health check |
| `*` | `/api/*` | All backend API routes (JIRA, specs, scenarios, tests, execution) |

## Example Quick Usage

1. Clone the repo and create a virtual environment.
2. Install dependencies with `pip install -r requirements.txt` from the `backend/` directory.
3. Set up a `.env` file in `backend/` with your JIRA, MongoDB, and Google Cloud credentials.
4. Start MongoDB locally.
5. Run `python run.py` from the `backend/` directory.
6. Open `http://localhost:8000`, enter a JIRA ticket ID, and follow the wizard.
