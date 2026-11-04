from rq import Worker

from app import create_app


def main() -> None:
    app = create_app()
    with app.app_context():
        queue = app.extensions["queue"]
        if queue is None:
            raise RuntimeError("Set REDIS_URL before starting the worker.")
        Worker([queue], connection=app.extensions["redis"]).work()


if __name__ == "__main__":
    main()
