# TaskFlow Generative UI

TaskFlow Generative UI is a full-stack todo app with a React/Vite frontend and a FastAPI backend. The frontend uses CopilotKit for AI-assisted interactions, while the backend stores todos in a CSV file.

## Features

- Create, update, delete, and complete todos
- AI-assisted UI powered by CopilotKit
- FastAPI REST API for todo persistence
- Local development setup for frontend and backend

## Project Structure

- backend/ - FastAPI server and CSV-based persistence
- frontend/ - Vite + React app and runtime server

## Prerequisites

- Node.js 18+
- Python 3.10+
- npm
- pip

## Backend Setup

1. Change into the backend folder:
   ```bash
   cd backend
   ```
2. Create and activate a virtual environment:
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   ```
3. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Start the backend:
   ```bash
   python main.py
   ```

The backend will run at:

- http://localhost:8000
- API docs: http://localhost:8000/docs

## Frontend Setup

1. Change into the frontend folder:
   ```bash
   cd frontend
   ```
2. Install Node dependencies:
   ```bash
   npm install
   ```
3. Create a .env file in the frontend folder if needed:
   ```env
   OPENAI_API_KEY=your_openai_key
   VITE_RUNTIME_URL=http://localhost:4000/copilotkit
   ```
4. Start the app:
   ```bash
   npm run dev
   ```

This starts the Vite client and the runtime server.

## Environment Notes

- Keep your API keys in the frontend .env file for local development.
- The runtime server reads environment variables from the frontend environment file.

## Usage

- Open the frontend in your browser at http://localhost:5173
- Use the todo UI to manage tasks
- The AI panel will connect to the runtime server on port 4000

## Notes

- The backend uses a local CSV file for data storage.
- If you want to reset demo data, remove or edit the CSV file in the backend folder.
