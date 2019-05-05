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
beanstalk.watch('test_send')
beanstalk.use('test_response')

#send message: aoi, response, original time, processing time
snd_msg = {}
snd_msg['aoi'] = "unk"
snd_msg['response'] = "unk"

while True:
	print("Waiting for a new file...")
	#monitor directory for new files to run
	#to get the job
	#receive message: aoi, time
	job = beanstalk.reserve()
	rcv_msg=json.loads(job.body)

	#delete the job you processed
	job.delete()

	try:
		#queue in beanstalk
		sleep(1)
		snd_msg['aoi']=rcv_msg['aoi']
		snd_msg['response']="processed!"
		snd_msg['timestamp']=rcv_msg['timestamp']
		snd_msg['processing_timestamp']=datetime.utcnow().strftime("%d%m%Y%H%M%S")
		s_snd_msg = json.dumps(snd_msg)
		beanstalk.put(s_snd_msg)

	except:
		print("error:", sys.exc_info()[0])
		raise