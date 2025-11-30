# Logging & Debugging Guide

This guide explains how to test and verify logs for your Firebase Functions API.

## 1. Running Locally with Logging

To see full function logs locally, use the `--inspect-functions` flag.

```bash
firebase emulators:start --only functions,hosting --inspect-functions
```

This will stream logs directly to your terminal.

## 2. Verifying Logs

### Step 1: Make a Request

Open a new terminal and run a simple curl command to hit your API:

```bash
# Health check (or non-existent route to trigger 404 logs)
curl -v http://localhost:5001/your-project-id/us-central1/api/api/health
```

*Note: Replace `your-project-id` with your actual Firebase project ID.*

### Step 2: Check Terminal Output

You should see output similar to:

```text
>  [Request Info] GET /api/health {
>    "method": "GET",
>    "path": "/api/health",
>    "status": 200,
>    "duration": "12ms",
>    "responseBody": "{\"status\":\"ok\"}"
>  }
```

### Step 3: Trigger an Error

Try a route that throws an error or doesn't exist:

```bash
curl -v http://localhost:5001/your-project-id/us-central1/api/api/crash-test
```

You should see a warn/error log:

```text
>  [Request Warn] GET /api/crash-test {
>    "status": 404,
>    ...
>  }
```

## 3. Viewing Logs in Production

After deploying (`firebase deploy --only functions`), go to:

1.  **Firebase Console** > **Functions**
2.  Click on the `api` function
3.  Click the **Logs** tab

You will see the same structured JSON logs there.

## 4. Debugging "Internal Server Error"

If you see a 500 error:

1.  Look for `[Express Error]` in the logs.
2.  It will contain the `stack` trace and `message`.
3.  If the error happens *before* Express starts (e.g. DB connection failed), look for `Failed to initialize Express app` log entry.
