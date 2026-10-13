import sys
import os
sys.path.insert(0, os.path.abspath("."))

import asyncio
import argparse
from app.core.database import AsyncSessionLocal
from sqlalchemy import select, update
from app.models.core import User
from app.api.routers.auth import _send_verification_email

async def list_unverified():
    async with AsyncSessionLocal() as db:
        users = (await db.execute(select(User).where(User.email_verified == False))).scalars().all()
        print(f"\n--- Found {len(users)} unverified accounts ---")
        for u in users:
            print(f"ID: {u.id} | Email: {u.email} | Role: {u.role} | Active: {u.is_active}")
        return users

async def verify_user(email: str):
    async with AsyncSessionLocal() as db:
        user = (await db.execute(select(User).where(User.email == email))).scalars().first()
        if not user:
            print(f"Error: User with email '{email}' not found.")
            return
        user.email_verified = True
        await db.commit()
        print(f"Success: User {email} is now verified (email_verified=True).")

async def verify_all():
    async with AsyncSessionLocal() as db:
        users = (await db.execute(select(User).where(User.email_verified == False))).scalars().all()
        if not users:
            print("No unverified users found.")
            return
        for u in users:
            u.email_verified = True
            print(f"Verified: {u.email}")
        await db.commit()
        print(f"Success: Verified all {len(users)} existing users.")

async def resend_email(email: str):
    async with AsyncSessionLocal() as db:
        user = (await db.execute(select(User).where(User.email == email))).scalars().first()
        if not user:
            print(f"Error: User with email '{email}' not found.")
            return
        await _send_verification_email(db, user.email, user.first_name, user.id)
        print(f"Success: Sent verification email to {email}.")

def main():
    parser = argparse.ArgumentParser(description="Manage verification status of existing accounts.")
    parser.add_argument("--list", action="store_true", help="List all unverified accounts")
    parser.add_argument("--verify", type=str, help="Verify a specific account by email")
    parser.add_argument("--verify-all", action="store_true", help="Verify all currently unverified accounts")
    parser.add_argument("--resend", type=str, help="Send verification email to a specific account")

    args = parser.parse_args()

    if args.verify:
        asyncio.run(verify_user(args.verify))
    elif args.verify_all:
        asyncio.run(verify_all())
    elif args.resend:
        asyncio.run(resend_email(args.resend))
    else:
        asyncio.run(list_unverified())

if __name__ == "__main__":
    main()
