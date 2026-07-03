import asyncio
import sys
import os

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))
from email_utils import send_email_async

async def test():
    recipient = "hj7779992@gmail.com"
    subject = "DMS Async Email Test"
    text = "Testing the async email sender."
    
    print(f"Sending async test email to {recipient}...")
    success = await send_email_async(recipient, subject, text)
    if success:
        print("✅ Async Success!")
    else:
        print("❌ Async Failed.")

if __name__ == "__main__":
    asyncio.run(test())
