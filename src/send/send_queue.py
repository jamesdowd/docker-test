#python3
#Core modules
import pystalkd
import os
import sys
from datetime import datetime
from time import sleep
import argparse
import json

parser = argparse.ArgumentParser()
parser.add_argument("server", type=str,help="server address")
parser.add_argument("port", type=int, help="port number")
args = parser.parse_args()

#Connect to processing queues
print('Connecting to processing queues...')
beanstalk = pystalkd.Beanstalkd.Connection(args.server, args.port)
beanstalk.use('test_send')
beanstalk.watch('test_response')

#send message: aoi, response, original time, processing time
snd_msg = {}

while True:
	aoi = input("AOI name? ")
	snd_msg['aoi'] = aoi
	snd_msg['timestamp']=datetime.utcnow().strftime("%d%m%Y%H%M%S")
	s_snd_msg = json.dumps(snd_msg)
	beanstalk.put(s_snd_msg)
	print("Message sent!")

	#monitor directory for new files to run
	#to get the job
	#receive message: aoi, time
	job = beanstalk.reserve()
	rcv_msg=json.loads(job.body)
	print(rcv_msg)
	#delete the job you processed
	job.delete()