import os
import requests
import msal
from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/api/powerbi", tags=["PowerBI"])

TENANT_ID = os.getenv("POWERBI_TENANT_ID")
CLIENT_ID = os.getenv("POWERBI_CLIENT_ID")
CLIENT_SECRET = os.getenv("POWERBI_CLIENT_SECRET")
WORKSPACE_ID = os.getenv("POWERBI_WORKSPACE_ID")
REPORT_ID = os.getenv("POWERBI_REPORT_ID")

def get_azure_ad_token() -> str:
    # 1. Safeguard: Check if environment variables exist
    if not all([TENANT_ID, CLIENT_ID, CLIENT_SECRET]):
        raise HTTPException(
            status_code=500, 
            detail="Power BI credentials are missing in the .env file."
        )

    # 2. Authenticate with Azure AD
    app = msal.ConfidentialClientApplication(
        CLIENT_ID, 
        authority=f"https://login.microsoftonline.com/{TENANT_ID}", 
        client_credential=CLIENT_SECRET
    )
    result = app.acquire_token_for_client(scopes=["https://analysis.windows.net/powerbi/api/.default"])
    
    if "access_token" in result:
        return result["access_token"]
        
    raise HTTPException(status_code=500, detail="Failed to acquire AD Token")

@router.get("/embed-token")
def get_embed_config():
    if not all([WORKSPACE_ID, REPORT_ID]):
        raise HTTPException(
            status_code=500, 
            detail="Power BI Workspace ID or Report ID is missing in the .env file."
        )

    headers = {"Authorization": f"Bearer {get_azure_ad_token()}", "Content-Type": "application/json"}
    
    # Generate Embed Token
    token_url = f"https://api.powerbi.com/v1.0/myorg/groups/{WORKSPACE_ID}/reports/{REPORT_ID}/GenerateToken"
    token_res = requests.post(token_url, json={"accessLevel": "View"}, headers=headers)
    
    if token_res.status_code != 200:
        raise HTTPException(status_code=500, detail="Failed to generate Power BI Embed Token")
    
    return {
        "reportId": REPORT_ID,
        "embedUrl": f"https://app.powerbi.com/reportEmbed?reportId={REPORT_ID}&groupId={WORKSPACE_ID}",
        "accessToken": token_res.json()["token"]
    }