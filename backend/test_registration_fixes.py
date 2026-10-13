import sys
import os
sys.path.insert(0, os.path.abspath("."))

import asyncio
import hashlib
from datetime import datetime, timedelta, timezone
import uuid
import httpx
from sqlalchemy import select, delete
from app.main import app
from app.core.database import AsyncSessionLocal
from app.models.core import User, Employee, VerificationToken
from app.core.security import get_password_hash

TEST_EMAIL = f"test_reg_{uuid.uuid4().hex[:8]}@example.com"
TEST_PASSWORD = "StrongTestPassword123!"

async def cleanup_test_user(email: str):
    async with AsyncSessionLocal() as db:
        user = (await db.execute(select(User).where(User.email == email))).scalars().first()
        if user:
            await db.execute(delete(VerificationToken).where(VerificationToken.user_id == user.id))
            await db.execute(delete(Employee).where(Employee.id == user.id))
            await db.execute(delete(User).where(User.id == user.id))
            await db.commit()

async def run_tests():
    print("=" * 70)
    print("RUNNING MAPLE INTRANET REGISTRATION & VERIFICATION TEST SUITE")
    print("=" * 70)
    
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        
        # -------------------------------------------------------------
        # TEST 1: Successful Signup
        # -------------------------------------------------------------
        print("\n[TEST 1] Testing signup endpoint...")
        signup_payload = {
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD,
            "first_name": "Test",
            "last_name": "User",
        }
        res_signup = await client.post("/api/v1/auth/signup", json=signup_payload)
        assert res_signup.status_code == 200, f"Signup failed: {res_signup.status_code} {res_signup.text}"
        signup_data = res_signup.json()
        assert "message" in signup_data, "Signup response missing message"
        print("  -> Signup response:", signup_data)
        
        # Verify user in database is unverified
        async with AsyncSessionLocal() as db:
            user = (await db.execute(select(User).where(User.email == TEST_EMAIL))).scalars().first()
            assert user is not None, "User was not created in database"
            assert user.email_verified is False, f"Expected email_verified=False, got {user.email_verified}"
            print("  -> User successfully created with email_verified=False.")

        # -------------------------------------------------------------
        # TEST 2: Unverified Login Rejection
        # -------------------------------------------------------------
        print("\n[TEST 2] Testing unverified login rejection...")
        login_payload = {
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD,
        }
        res_login_unverified = await client.post("/api/v1/auth/login", json=login_payload)
        assert res_login_unverified.status_code == 403, f"Expected 403 Forbidden, got {res_login_unverified.status_code}"
        login_err = res_login_unverified.json()
        assert "not been verified" in login_err["detail"], f"Unexpected error message: {login_err}"
        print("  -> Unverified login correctly rejected with 403:", login_err["detail"])

        # -------------------------------------------------------------
        # TEST 3: Link Opened Without Verification (GET Request)
        # -------------------------------------------------------------
        print("\n[TEST 3] Testing opening verification link (GET read-only inspection)...")
        # Find issued token for this user
        async with AsyncSessionLocal() as db:
            stmt = select(VerificationToken).where(VerificationToken.user_id == user.id)
            tok_record = (await db.execute(stmt)).scalars().first()
        
        # Let's create a known token to test
        raw_valid_token = "valid_test_token_1234567890abcdef"
        token_hash = hashlib.sha256(raw_valid_token.encode()).hexdigest()
        async with AsyncSessionLocal() as db:
            db_tok = VerificationToken(
                user_id=user.id,
                token_hash=token_hash,
                expires_at=datetime.now(timezone.utc) + timedelta(hours=24),
                used_at=None,
            )
            db.add(db_tok)
            await db.commit()

        # Simulate email scanner or browser opening the link (GET)
        res_get = await client.get(f"/api/v1/auth/verify-email?token={raw_valid_token}")
        assert res_get.status_code == 200, f"GET verify-email failed: {res_get.text}"
        get_data = res_get.json()
        assert get_data.get("status") == "valid", f"Unexpected GET status: {get_data}"
        print("  -> GET verify-email response:", get_data)

        # Confirm account was NOT verified merely by opening the link
        async with AsyncSessionLocal() as db:
            user_check = (await db.execute(select(User).where(User.id == user.id))).scalars().first()
            assert user_check.email_verified is False, "CRITICAL ERROR: Account was marked verified merely because link was opened!"
            tok_check = (await db.execute(select(VerificationToken).where(VerificationToken.token_hash == token_hash))).scalars().first()
            assert tok_check.used_at is None, "CRITICAL ERROR: Token was marked used on GET request!"
            print("  -> Confirmed: Account remained unverified after link was opened.")

        # -------------------------------------------------------------
        # TEST 4: Valid Verification Execution (POST Request)
        # -------------------------------------------------------------
        print("\n[TEST 4] Testing valid token verification (POST confirm)...")
        res_post_verify = await client.post("/api/v1/auth/verify-email", json={"token": raw_valid_token})
        assert res_post_verify.status_code == 200, f"POST verify-email failed: {res_post_verify.text}"
        post_data = res_post_verify.json()
        assert post_data.get("already_verified") is False
        print("  -> Verification success response:", post_data)

        # Confirm account is now verified and token is marked used
        async with AsyncSessionLocal() as db:
            user_check = (await db.execute(select(User).where(User.id == user.id))).scalars().first()
            assert user_check.email_verified is True, "User should be verified now"
            tok_check = (await db.execute(select(VerificationToken).where(VerificationToken.token_hash == token_hash))).scalars().first()
            assert tok_check.used_at is not None, "Token must be marked used"
            print("  -> Confirmed: email_verified=True and token used_at is recorded.")

        # -------------------------------------------------------------
        # TEST 5: Single-Use Token Reuse Rejection
        # -------------------------------------------------------------
        print("\n[TEST 5] Testing token reuse rejection...")
        res_reuse = await client.post("/api/v1/auth/verify-email", json={"token": raw_valid_token})
        assert res_reuse.status_code == 400, f"Expected 400 for reused token, got {res_reuse.status_code}"
        reuse_err = res_reuse.json()
        assert "already been used" in reuse_err["detail"], f"Unexpected error detail: {reuse_err}"
        print("  -> Token reuse correctly blocked with 400:", reuse_err["detail"])

        # -------------------------------------------------------------
        # TEST 6: Expired Token Rejection
        # -------------------------------------------------------------
        print("\n[TEST 6] Testing expired token rejection...")
        raw_expired_token = "expired_token_1234567890abcdef"
        expired_hash = hashlib.sha256(raw_expired_token.encode()).hexdigest()
        async with AsyncSessionLocal() as db:
            db_exp_tok = VerificationToken(
                user_id=user.id,
                token_hash=expired_hash,
                expires_at=datetime.now(timezone.utc) - timedelta(hours=1), # Expired 1 hour ago
                used_at=None,
            )
            db.add(db_exp_tok)
            await db.commit()

        res_expired = await client.post("/api/v1/auth/verify-email", json={"token": raw_expired_token})
        assert res_expired.status_code == 400, f"Expected 400 for expired token, got {res_expired.status_code}"
        exp_err = res_expired.json()
        assert "expired" in exp_err["detail"].lower(), f"Unexpected error detail: {exp_err}"
        print("  -> Expired token correctly rejected with 400:", exp_err["detail"])

        # -------------------------------------------------------------
        # TEST 7: Invalid / Tampered Token Rejection
        # -------------------------------------------------------------
        print("\n[TEST 7] Testing invalid token rejection...")
        res_invalid = await client.post("/api/v1/auth/verify-email", json={"token": "completely_fake_token"})
        assert res_invalid.status_code == 400, f"Expected 400 for invalid token, got {res_invalid.status_code}"
        inv_err = res_invalid.json()
        print("  -> Invalid token correctly rejected with 400:", inv_err["detail"])

        # -------------------------------------------------------------
        # TEST 8: Verified Login Success & Response Structure
        # -------------------------------------------------------------
        print("\n[TEST 8] Testing verified login success and response structure...")
        res_login_verified = await client.post("/api/v1/auth/login", json=login_payload)
        assert res_login_verified.status_code == 200, f"Verified login failed: {res_login_verified.text}"
        auth_data = res_login_verified.json()
        assert "access_token" in auth_data, "Missing access_token"
        assert "user" in auth_data, "Missing user in response"
        u_data = auth_data["user"]
        assert "navigation_tour_completed" in u_data, "Missing navigation_tour_completed in login response!"
        assert "onboarding_completed" in u_data, "Missing onboarding_completed in login response!"
        print(f"  -> Verified login succeeded! User data:")
        print(f"     navigation_tour_completed: {u_data['navigation_tour_completed']}")
        print(f"     onboarding_completed: {u_data['onboarding_completed']}")
        print(f"     roles: {u_data['roles']}")

        # -------------------------------------------------------------
        # TEST 9: Duplicate Email Handling
        # -------------------------------------------------------------
        print("\n[TEST 9] Testing duplicate email handling...")
        # 9a: Duplicate of verified account -> 400 "already exists"
        res_dup_verified = await client.post("/api/v1/auth/signup", json=signup_payload)
        assert res_dup_verified.status_code == 400, f"Expected 400 for duplicate verified email, got {res_dup_verified.status_code}"
        dup_err = res_dup_verified.json()
        assert "already exists" in dup_err["detail"], f"Unexpected error detail: {dup_err}"
        print("  -> Duplicate verified registration correctly rejected with 400:", dup_err["detail"])

        # 9b: Duplicate of unverified account -> resends verification safely
        dup_unverified_email = f"unverified_dup_{uuid.uuid4().hex[:8]}@example.com"
        res_first_signup = await client.post("/api/v1/auth/signup", json={
            "email": dup_unverified_email,
            "password": "Password123!",
            "first_name": "Dup",
            "last_name": "Test",
        })
        assert res_first_signup.status_code == 200
        
        # Second signup attempt with same unverified email
        res_dup_unverified = await client.post("/api/v1/auth/signup", json={
            "email": dup_unverified_email,
            "password": "Password123!",
            "first_name": "Dup",
            "last_name": "Test",
        })
        assert res_dup_unverified.status_code == 200
        dup_unverified_data = res_dup_unverified.json()
        assert dup_unverified_data.get("pending_verification") is True
        print("  -> Duplicate unverified registration safely triggers resend notice:", dup_unverified_data["message"])
        await cleanup_test_user(dup_unverified_email)

        # -------------------------------------------------------------
        # TEST 10: Resend Verification Endpoint
        # -------------------------------------------------------------
        print("\n[TEST 10] Testing resend-verification endpoint...")
        res_resend = await client.post("/api/v1/auth/resend-verification", json={"email": TEST_EMAIL})
        assert res_resend.status_code == 200
        print("  -> Resend verification response:", res_resend.json())

        # -------------------------------------------------------------
        # TEST 11: Rate Limiting & Safe Reverse Proxy IP
        # -------------------------------------------------------------
        print("\n[TEST 11] Testing rate limiting and reverse proxy IP extraction...")
        # Rapidly hit /signup with same IP to trigger 5/minute limit
        rate_limit_triggered = False
        flood_headers = {
            "x-forwarded-for": "198.51.100.42, 10.0.0.1", # Custom IP
            "x-render-client-ip": "198.51.100.42"
        }
        for i in range(7):
            spam_email = f"flood_{i}_{uuid.uuid4().hex[:6]}@example.com"
            r = await client.post("/api/v1/auth/signup", json={
                "email": spam_email,
                "password": "Password123!",
                "first_name": "Spam",
                "last_name": "Bot",
            }, headers=flood_headers)
            if r.status_code == 429:
                rate_limit_triggered = True
                rl_body = r.json()
                print(f"  -> Rate limit successfully triggered on attempt {i+1} with 429: {rl_body}")
                assert "detail" in rl_body
                break
            await cleanup_test_user(spam_email)

        assert rate_limit_triggered, "Rate limiter did not trigger 429 after exceeding limit!"

    # Final cleanup
    await cleanup_test_user(TEST_EMAIL)
    print("\n" + "=" * 70)
    print("ALL 11 TEST SUITES PASSED PERFECTLY!")
    print("=" * 70)

if __name__ == "__main__":
    asyncio.run(run_tests())
