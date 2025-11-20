# Azure Logs AWS Lambda

This is a standalone AWS Lambda function that queries Azure Application Insights logs. It accepts search parameters (like an order number) and returns the matching log entries.

## Prerequisites

- Node.js (v18 or later recommended)
- npm

## Setup

1. Navigate to the lambda directory:
   ```bash
   cd aws-lambda
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

## Configuration

### Environment Variables

The function requires the following environment variables to authenticate with Azure.

| Variable | Description |
|----------|-------------|
| `AZURE_CLIENT_ID` | Azure App Registration Client ID |
| `AZURE_TENANT_ID` | Azure Tenant ID |
| `AZURE_CLIENT_SECRET` | Azure App Registration Client Secret |
| `AZURE_MONITOR_WORKSPACE_ID` | Azure Monitor Workspace ID |

**Local Development:**
Create a `.env` file in this directory (see `.env.example` or the root `.env` if available).

**AWS Lambda:**
Set these variables in the **Configuration** -> **Environment variables** section of your Lambda function in the AWS Console.

## Building

To compile the TypeScript code into JavaScript:

```bash
npm run build
```

This will generate the compiled files in the `dist` directory.

## Deployment

To deploy to AWS Lambda, you need to create a deployment package (zip file) and upload it.

### 1. Create Zip Package

**Windows (PowerShell):**
Run this command to zip the necessary files while **excluding** the `.env` file (for security):

```powershell
Compress-Archive -Path .\dist\*, .\node_modules -DestinationPath lambda_deploy.zip
```

**Mac/Linux:**
```bash
zip -r lambda_deploy.zip dist node_modules
```

### 2. Upload to AWS

1. Go to the [AWS Lambda Console](https://console.aws.amazon.com/lambda/).
2. Create or select your function.
3. In the **Code** tab, click **Upload from** -> **.zip file**.
4. Select the `lambda_deploy.zip` file you created.
5. Go to **Configuration** -> **Environment variables** and add the Azure credentials listed above.

## Usage / Testing

You can test the function using the "Test" tab in the AWS Lambda Console with the following JSON event:

```json
{
  "searchTerm": "ORD-12345",
  "limit": 20,
  "duration": "P3D"
}
```

### Parameters

- `searchTerm`: The string to search for in the logs.
- `limit` (optional): Max number of rows to return (default: 50).
- `duration` (optional): ISO 8601 duration string (default: "P7D" for 7 days).

## Invocation

### Option 1: Direct Invocation (AWS Console / CLI)
Use the JSON payload described in "Usage / Testing".

### Option 2: Function URL (Public Endpoint)
1. Enable **Function URL** in the AWS Lambda Console (Configuration -> Function URL).
2. Choose Auth type (NONE for public, AWS_IAM for restricted).
3. Send a POST request to the generated URL:

```bash
curl -X POST https://<your-function-url>.lambda-url.<region>.on.aws/ \
     -H "Content-Type: application/json" \
     -d '{"searchTerm": "ORD-12345", "limit": 10}'
```

