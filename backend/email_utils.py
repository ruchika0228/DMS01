import httpx
import logging
import os
from dotenv import load_dotenv

load_dotenv()

# Configuration
EMAIL_API_URL = "https://virtualvaani.vgipl.com:5681/api/v1/email/send"
EMAIL_API_TOKEN = os.getenv("EMAIL_API_TOKEN", "etk_live_HARgXA0z0ZwBR0axbn88Rgkgz3i3fWhIt_5SCNJA1BQ")

logger = logging.getLogger(__name__)

async def send_email_async(to_email: str, subject: str, text_content: str):
    """
    Sends an email using the external virtualvaani API asynchronously.
    """
    print(f"EMAIL_UTILS: Attempting to send async email to {to_email} with subject '{subject}'")
    headers = {
        "Authorization": f"Bearer {EMAIL_API_TOKEN}",
        "Content-Type": "application/json"
    }
    payload = {
        "to": to_email,
        "subject": subject,
        "text": text_content
    }

    try:
        async with httpx.AsyncClient(verify=False) as client: # verify=False because it might be a self-signed cert given the port
            response = await client.post(EMAIL_API_URL, headers=headers, json=payload, timeout=10.0)
            print(f"EMAIL_UTILS: Response from API for {to_email}: {response.status_code} - {response.text}")
            response.raise_for_status()
            logger.info(f"Email sent successfully to {to_email}")
            return True
    except Exception as e:
        print(f"EMAIL_UTILS: ERROR sending to {to_email}: {str(e)}")
        logger.error(f"Failed to send email to {to_email}: {str(e)}")
        return False

def send_email_sync(to_email: str, subject: str, text_content: str):
    """
    Sends an email using the external virtualvaani API synchronously.
    """
    headers = {
        "Authorization": f"Bearer {EMAIL_API_TOKEN}",
        "Content-Type": "application/json"
    }
    payload = {
        "to": to_email,
        "subject": subject,
        "text": text_content
    }

    try:
        with httpx.Client(verify=False) as client:
            response = client.post(EMAIL_API_URL, headers=headers, json=payload, timeout=10.0)
            response.raise_for_status()
            logger.info(f"Email sent successfully to {to_email}")
            return True
    except Exception as e:
        logger.error(f"Failed to send email to {to_email}: {str(e)}")
        return False
