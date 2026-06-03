deploy:
	docker network inspect docker_internal >/dev/null 2>&1 || docker network create docker_internal
	git pull && docker compose up -d --build

logs:
	docker compose logs -f

restart:
	docker compose restart

stop:
	docker compose down
