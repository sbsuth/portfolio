start:
	ulimit -c unlimited; \
	echo "Starting portfolio.  Log file `pwd`/portfolio.log"; \
	npm start 2>&1 | cat >  portfolio.log &
	make log

stop:
	npm stop

restart: stop start

log:
	tail -f portfolio.log

ps:
	-ps -auxw | grep node | grep -v grep

restart_db:
	sudo systemctl restart mongodb.service
