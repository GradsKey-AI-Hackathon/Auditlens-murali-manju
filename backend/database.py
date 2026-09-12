import os

import mysql.connector
from mysql.connector import pooling
from dotenv import load_dotenv

load_dotenv("/home/hackathon/.env")


DB_CONFIG = {
    "host": os.getenv("DB_HOST", "localhost"),
    "port": int(os.getenv("DB_PORT", "3306")),
    "user": os.getenv("DB_USER"),
    "password": os.getenv("DB_PASSWORD"),
    "database": os.getenv("DB_NAME"),
}


connection_pool = pooling.MySQLConnectionPool(
    pool_name="hackathon_pool",
    pool_size=5,
    pool_reset_session=True,
    **DB_CONFIG,
)


def get_db():
    """
    Get a MySQL connection from the connection pool.
    """
    return connection_pool.get_connection()
