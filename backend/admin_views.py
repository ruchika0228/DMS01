from sqladmin import ModelView
from models.user import User
from models.file import File, FileSection, Transfer, OCRResult
from models.connection import Connection

class UserAdmin(ModelView, model=User):
    column_list = [User.id, User.username, User.email, User.is_active, User.created_at]

class FileAdmin(ModelView, model=File):
    column_list = [File.id, File.file_name, File.file_type, File.file_size, File.owner_id]

class FileSectionAdmin(ModelView, model=FileSection):
    column_list = [FileSection.id, FileSection.file_id, FileSection.section_index]

class TransferAdmin(ModelView, model=Transfer):
    column_list = [Transfer.id, Transfer.file_id, Transfer.sender_id, Transfer.receiver_id, Transfer.sent_at]

class OCRResultAdmin(ModelView, model=OCRResult):
    column_list = [OCRResult.id, OCRResult.file_id, OCRResult.user_id, OCRResult.created_at]

class ConnectionAdmin(ModelView, model=Connection):
    column_list = [Connection.id, Connection.requester_id, Connection.addressee_id, Connection.status, Connection.created_at]

from models.block import Block

class BlockAdmin(ModelView, model=Block):
    column_list = [Block.tx_id, Block.file_id, Block.timestamp, Block.prev_tx_id]
