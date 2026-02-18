"""MongoDB database connection."""
from motor.motor_asyncio import AsyncIOMotorClient
from app.config.settings import settings


class Database:
    """Database connection manager."""
    
    client: AsyncIOMotorClient = None
    database = None


db = Database()


async def connect_to_mongo():
    """Connect to MongoDB."""
    db.client = AsyncIOMotorClient(settings.MONGO_URI)
    db.database = db.client[settings.MONGO_DB_NAME]
    print(f"Connected to MongoDB: {settings.MONGO_DB_NAME}")


async def close_mongo_connection():
    """Close MongoDB connection."""
    if db.client:
        db.client.close()
        print("Disconnected from MongoDB")


def get_database():
    """Get database instance."""
    return db.database
