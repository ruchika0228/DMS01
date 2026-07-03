from fastapi import FastAPI
from sqladmin import Admin
from database import engine
from admin_views import (
    UserAdmin, FileAdmin, FileSectionAdmin, 
    TransferAdmin, OCRResultAdmin, ConnectionAdmin, BlockAdmin
)

# Create a separate FastAPI app for the Admin interface
admin_app = FastAPI(title="Database Admin Console")

# Setup Admin on the separate app
admin = Admin(admin_app, engine)

# Add Views
admin.add_view(UserAdmin)
admin.add_view(FileAdmin)
admin.add_view(FileSectionAdmin)
admin.add_view(TransferAdmin)
admin.add_view(OCRResultAdmin)
admin.add_view(ConnectionAdmin)
admin.add_view(BlockAdmin)

if __name__ == "__main__":
    import uvicorn
    # Run this app on port 4001
    uvicorn.run(admin_app, host="0.0.0.0", port=4001)
