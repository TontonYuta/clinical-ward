"""Interactively create the first director account in identity storage.

Run from backend: python -m app.scripts.bootstrap_identity_admin
No account is created unless an operator explicitly enters every field.
"""
import asyncio
import getpass

from sqlalchemy import func, select

from app.identity_database import get_identity_session_factory
from app.models.identity import StaffAccount, StaffRoleGrant
from app.services.identity_bootstrap import create_staff_account


async def bootstrap() -> None:
    from sqlalchemy import inspect
    from app.identity_database import IDENTITY_DATABASE_URL, get_identity_session_factory, validate_identity_database_url
    from app.models.identity import IdentityBase
    if not IDENTITY_DATABASE_URL:
        raise RuntimeError(
            "IDENTITY_DATABASE_URL is missing. Provision a separate identity database first; "
            "the clinical SQLite database is never used for staff credentials."
        )
    validate_identity_database_url(IDENTITY_DATABASE_URL)
    identity_engine, factory = get_identity_session_factory()
    try:
        async with identity_engine.connect() as connection:
            table_names = await connection.run_sync(lambda sync_connection: set(inspect(sync_connection).get_table_names()))
        if set(IdentityBase.metadata.tables) - table_names:
            raise RuntimeError("Identity schema is not initialized. Run python -m app.scripts.init_identity_schema first.")
        async with factory() as session:
            existing = await session.scalar(
                select(func.count()).select_from(StaffRoleGrant).where(StaffRoleGrant.role == "director")
            )
            if existing:
                raise RuntimeError("A director role already exists. Use the approved account management process.")
            print("Create the first director account. No demo credentials will be generated.")
            employee_number = input("Mã nhân viên (Enter nếu không áp dụng): ").strip() or None
            full_name = input("Họ và tên: ").strip()
            department = input("Khoa/phòng: ").strip()
            job_title = input("Chức danh: ").strip()
            username = input("Tên đăng nhập: ").strip()
            password = getpass.getpass("Mật khẩu (tối thiểu 12 ký tự): ")
            confirmation = getpass.getpass("Nhập lại mật khẩu: ")
            if password != confirmation:
                raise ValueError("Mật khẩu nhập lại không khớp.")
            certificate = input("Chứng chỉ hành nghề (Enter nếu không có): ").strip() or None
            account = await create_staff_account(
                session, employee_number=employee_number, full_name=full_name,
                department=department, job_title=job_title, username=username,
                password=password, role="director", practice_certificate=certificate,
            )
            print(f"Đã tạo tài khoản {account.username} với quyền director. Mật khẩu không được lưu hoặc hiển thị.")
    finally:
        await identity_engine.dispose()


def main() -> None:
    asyncio.run(bootstrap())


if __name__ == "__main__":
    main()
