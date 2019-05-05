# docker-test

build the receiver in it's folder: docker build -t python-receive .

build beanstalkd in it's folder: docker build -t beanstalkd .

create a .env file in the same folder as docker-compose and put the following in it: port=[desired port #]

run the docker compose file: docker-compose up
