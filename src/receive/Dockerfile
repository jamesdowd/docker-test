FROM python:alpine3.7
ADD receive_queue.py /

ARG PORT=11302
ENV port=$PORT
ENV server="localhost"

RUN pip install pystalkd

CMD python ./receive_queue.py $server $port