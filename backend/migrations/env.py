"""Flask-Migrate environment for the SQLAlchemy 2 application."""

from logging.config import fileConfig

from alembic import context
from flask import current_app

config = context.config
if config.config_file_name:
    fileConfig(config.config_file_name, disable_existing_loggers=False)

migration = current_app.extensions["migrate"]
engine = migration.db.engine
metadata = migration.db.metadata


def run_migrations_offline() -> None:
    context.configure(
        url=engine.url.render_as_string(hide_password=False),
        target_metadata=metadata,
        literal_binds=True,
        **migration.configure_args,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    with engine.connect() as connection:
        context.configure(
            connection=connection, target_metadata=metadata, **migration.configure_args
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
