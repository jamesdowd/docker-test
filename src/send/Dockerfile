FROM python:3
ADD send_queue.py /

RUN pip install pystalkd

CMD python ./send_queue.py